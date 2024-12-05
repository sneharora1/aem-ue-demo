import {
  decorateBlock,
  decorateBlocks,
  decorateButtons,
  decorateIcons,
  decorateSections,
  loadBlock,
  loadBlocks,
} from './aem.js';
import { decorateRichtext } from './editor-support-rte.js';
import {
  decorateMain, buildAutoBlocks, decorateDeliveryImages, decorateDeliveryVideos,
} from './scripts.js';

async function applyChanges(event) {
  // redecorate default content and blocks on patches (in the properties rail)
  const { detail } = event;

  const resource = detail?.request?.target?.resource // update, patch components
    || detail?.request?.target?.container?.resource // update, patch, add to sections
    || detail?.request?.to?.container?.resource; // move in sections
  if (!resource) return false;
  const updates = detail?.response?.updates;
  if (!updates.length) return false;
  const { content } = updates[0];
  if (!content) return false;

  const element = document.querySelector(`[data-aue-resource="${resource}"]`);
  const parsedUpdate = new DOMParser().parseFromString(content, 'text/html');

  if (element) {
    if (element.matches('main')) {
      const newMain = parsedUpdate.querySelector(`[data-aue-resource="${resource}"]`);
      newMain.style.display = 'none';
      element.insertAdjacentElement('afterend', newMain);
      decorateMain(newMain);
      decorateRichtext(newMain);
      await loadBlocks(newMain);
      element.remove();
      newMain.style.display = null;
      // eslint-disable-next-line no-use-before-define
      attachEventListners(newMain);
      return true;
    }

    const block = element.parentElement?.closest('.block[data-aue-resource]')
      || element?.closest('.block[data-aue-resource]')
      || element?.closest('.dynamic-block[data-aue-resource]');
    if (block) {
      const blockResource = block.getAttribute('data-aue-resource');
      const newBlock = parsedUpdate.querySelector(`[data-aue-resource="${blockResource}"]`);
      if (newBlock) {
        if (block.matches('.dynamic-block')) {
          // dynamic blocks manage their updates themself, dispatch an event to it
          // this is used to update the state of clientside rendered stateful applications like
          // multi step forms
          decorateButtons(newBlock);
          decorateIcons(newBlock);
          decorateDeliveryVideos(newBlock);
          decorateDeliveryImages(newBlock);
          decorateBlock(newBlock);
          decorateRichtext(newBlock);
          element.dispatchEvent(new CustomEvent('apply-update', { detail: newBlock.outerHTML }));
          return true;
        }
        newBlock.style.display = 'none';
        block.insertAdjacentElement('afterend', newBlock);
        decorateButtons(newBlock);
        decorateIcons(newBlock);
        decorateDeliveryVideos(newBlock);
        decorateDeliveryImages(newBlock);
        decorateBlock(newBlock);
        decorateRichtext(newBlock);
        await loadBlock(newBlock);
        block.remove();
        newBlock.style.display = null;
        return true;
      }
    } else {
      // sections and default content, may be multiple in the case of richtext
      const newElements = parsedUpdate.querySelectorAll(`[data-aue-resource="${resource}"],[data-richtext-resource="${resource}"]`);
      if (newElements.length) {
        const { parentElement } = element;
        if (element.matches('.section')) {
          const [newSection] = newElements;
          newSection.style.display = 'none';
          element.insertAdjacentElement('afterend', newSection);
          decorateButtons(newSection);
          decorateIcons(newSection);
          buildAutoBlocks(parentElement);
          decorateDeliveryVideos(newSection);
          decorateDeliveryImages(newSection);
          decorateRichtext(newSection);
          decorateSections(parentElement);
          decorateBlocks(parentElement);
          await loadBlocks(parentElement);
          element.remove();
          newSection.style.display = null;
        } else {
          element.replaceWith(...newElements);
          decorateButtons(parentElement);
          decorateIcons(parentElement);
          decorateRichtext(parentElement);
        }
        return true;
      }
    }
  }

  return false;
}

function handleSelection(event) {
  const { detail } = event;
  const resource = detail?.resource;

  if (resource) {
    const element = document.querySelector(`[data-aue-resource="${resource}"]`);
    const block = element.parentElement?.closest('.block') || element?.closest('.block');
    if (block && block.matches('.dynamic-block')) {
      if (block?.dataset.activeRoute) {
        // if the block does some routing we notify it about the new route based on the selection
        // the children of the block are the containers for the route, the first class name
        // the route name
        const newRoute = [...block.children].find((child) => child.contains(element));
        if (newRoute) {
          const [newRouteName] = newRoute.className.split(' ');
          block.dispatchEvent(new CustomEvent('navigate-to-route', { detail: { route: newRouteName } }));
        }
      } else {
        block.dispatchEvent(new CustomEvent('navigate-to-route', { detail: { prop: detail.prop, element } }));
      }
    }
  }
}

function attachEventListners(main) {
  [
    'aue:content-patch',
    'aue:content-update',
    'aue:content-add',
    'aue:content-move',
    'aue:content-remove',
  ].forEach((eventType) => main?.addEventListener(eventType, async (event) => {
    event.stopPropagation();
    const applied = await applyChanges(event);
    if (!applied) window.location.reload();
  }));

  main?.addEventListener('aue:ui-select', handleSelection);
}

// listen for dynamic instrumetnation of images with art direction
(function dynamicInstrumentation() {
  const mediaQueries = {};
  const setInstrumenation = (target, instr) => {
    // eslint-disable-next-line no-restricted-syntax
    for (const [prop, value] of Object.entries(instr)) {
      target.setAttribute(prop, value);
    }
  };
  const handleEvent = () => {
    // eslint-disable-next-line no-restricted-syntax
    for (const target of document.querySelectorAll('[data-dynamic-instrumentation]')) {
      const dynInstr = JSON.parse(target.dataset.dynamicInstrumentation);
      // eslint-disable-next-line no-restricted-syntax
      for (const [mediaQuery, instr] of Object.entries(dynInstr)) {
        if (mediaQueries[mediaQuery]?.matches) {
          setInstrumenation(target, instr);
          break;
        }
        // apply default instrumenation if no media query matches
        if (!mediaQuery) {
          setInstrumenation(target, instr);
        }
      }
    }
  };

  // observe elements with data-dynamic-instrumentation and
  // create a MediaQueryList for each unique  media query
  const dynInstrObserver = new MutationObserver((entries) => {
    // eslint-disable-next-line no-restricted-syntax
    for (const { target } of entries) {
      if (target.dataset.dynamicInstrumentation) {
        const dynInstr = JSON.parse(target.dataset.dynamicInstrumentation);
        // eslint-disable-next-line no-restricted-syntax
        for (const mediaQuery of Object.keys(dynInstr)) {
          if (mediaQuery && !mediaQueries[mediaQuery]) {
            mediaQueries[mediaQuery] = window.matchMedia(`(${mediaQuery})`);
            mediaQueries[mediaQuery].addEventListener('change', handleEvent);
          }
        }
      }
    }
    handleEvent();
  });
  dynInstrObserver.observe(document, { attributeFilter: ['data-dynamic-instrumentation'], subtree: true });
}());

attachEventListners(document.querySelector('main'));
