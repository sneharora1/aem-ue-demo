import {
  loadHeader,
  loadFooter,
  decorateButtons,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
} from './aem.js';

const DELIVERY_ASSET_IDENTIFIER = '/adobe/assets/urn:aaid:aem:';
const DELIVERY_VIDEO_IDENTIFIER = '/play';
const DELIVERY_IMAGE_IDENTIFIER = '/as/';


/**
 * Moves all the attributes from a given elmenet to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveAttributes(from, to, attributes) {
  if (!attributes) {
    // eslint-disable-next-line no-param-reassign
    attributes = [...from.attributes].map(({ nodeName }) => nodeName);
  }
  attributes.forEach((attr) => {
    const value = from.getAttribute(attr);
    if (value) {
      to.setAttribute(attr, value);
      from.removeAttribute(attr);
    }
  });
}
export function mergeImagesForArtDirection(img, imgMobile) {
  const removeInstrumentation = (of) => {
    const attributes = [...of.attributes].filter(
      ({ nodeName }) => nodeName.startsWith('data-aue-') || nodeName.startsWith('data-richtext-'),
    );
    if (attributes.length) {
      // eslint-disable-next-line no-restricted-syntax
      for (const { nodeName } of attributes) of.removeAttribute(nodeName);
      // eslint-disable-next-line max-len
      return attributes.reduce((prev, { nodeName, nodeValue }) => ({ ...prev, [nodeName]: nodeValue }), {});
    }
    return null;
  };
  const applyDynamicInstrumentation = () => {
    const dynamicInstrumentation = {};
    // eslint-disable-next-line no-restricted-syntax
    for (const entry of [[img, 'min-width: 600px'], [imgMobile]]) {
      const [element, mediaQuery = ''] = entry;
      const instrumentation = removeInstrumentation(element);
      if (!instrumentation) {
        return;
      }
      dynamicInstrumentation[mediaQuery] = instrumentation;
    }
    imgMobile.dataset.dynamicInstrumentation = JSON.stringify(dynamicInstrumentation);
  };

  if (imgMobile) {
    const pictureMobile = imgMobile.parentElement;
    // merge the imgMobile into the img:
    // the sources have min-width media queries for desktop,
    // we select the one without a media query which is for mobile
    const pictureMobileMobileSource = pictureMobile.querySelector('source:not([media])');
    if (pictureMobileMobileSource) {
      const pcitureMobileSource = img.parentElement.querySelector('source:not([media])');
      if (pcitureMobileSource) pcitureMobileSource.replaceWith(pictureMobileMobileSource);
      else img.before(pictureMobileMobileSource);
    } else {
      // create a source if there are non (authoring specific case)
      const source = document.createElement('source');
      source.srcset = img.src;
      source.media = '(min-width: 600px)';
      img.before(source);
    }
    // the fallback image should also be the mobile one itself is also mobile so replace it
    img.replaceWith(imgMobile);
    // remove picture mobile
    const p = pictureMobile.parentElement;
    pictureMobile.remove();
    if (p.children.length === 0 && !p.textContent.trim()) p.remove();
    // the instrumentation depends on the viewport size, so we remove it
    applyDynamicInstrumentation();
  }
}
function createOptimizedPictureWithDeliveryUrls(
  src,
  alt = '',
  eager = false,
  breakpoints = [{ media: '(min-width: 600px)', width: '2000' }, { width: '750' }],
) {
  const url = new URL(src, window.location.href);
  const width = url.searchParams.get('width');
  const height = url.searchParams.get('height');
  const picture = document.createElement('picture');
  // webp
  breakpoints.forEach((br) => {
    const source = document.createElement('source');
    const webpUrl = new URL(url.href); // Clone original URL
    webpUrl.searchParams.set('width', br.width);
    webpUrl.searchParams.set('id', '1');
     webpUrl.searchParams.set('quality', '65');
    if (br.media) source.setAttribute('media', br.media);
    source.setAttribute('srcset', webpUrl.href);
    if (height) {
      source.setAttribute('height', height);
    }
    if (width) {
      source.setAttribute('width', width);
    }
    picture.appendChild(source);
  });

  // fallback
  breakpoints.forEach((br, i) => {
    const fallbackUrl = new URL(url.href); // Clone original URL
    fallbackUrl.searchParams.set('width', br.width);

    if (i < breakpoints.length - 1) {
      const source = document.createElement('source');
      if (br.media) source.setAttribute('media', br.media);
      source.setAttribute('srcset', fallbackUrl.href);
      if (height) {
        source.setAttribute('height', height);
      }
      if (width) {
        source.setAttribute('width', width);
      }
      picture.appendChild(source);
    } else {
      const img = document.createElement('img');
      img.setAttribute('loading', eager ? 'eager' : 'lazy');
      img.setAttribute('alt', alt);
      img.setAttribute('src', fallbackUrl.href);
      if (height) {
        img.setAttribute('height', height);
      }
      if (width) {
        img.setAttribute('width', width);
      }
      picture.appendChild(img);
    }
  });

  return picture;
}

/**
 * Decorates delivery assets by replacing anchor elements with optimized pictures.
 * @param {HTMLElement} main - The main element containing the anchor elements.
 */
export function decorateDeliveryImages(main) {
  const anchors = Array.from(main.getElementsByTagName('a'));
  const deliveryUrls = anchors.filter((anchor) => anchor.href
    .includes(DELIVERY_ASSET_IDENTIFIER) && anchor.href.includes(DELIVERY_IMAGE_IDENTIFIER));
  if (deliveryUrls.length > 0) {
    deliveryUrls.forEach((anchor) => {
      const deliveryUrl = anchor.href;
      const altText = anchor.title;
      const picture = createOptimizedPictureWithDeliveryUrls(deliveryUrl, altText);
      anchor.replaceWith(picture);
    });
  }
}

/**
 * Move instrumentation attributes from a given element to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveInstrumentation(from, to) {
  moveAttributes(
    from,
    to,
    [...from.attributes]
      .map(({ nodeName }) => nodeName)
      .filter((attr) => attr.startsWith('data-aue-') || attr.startsWith('data-richtext-')),
  );
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
export function buildAutoBlocks() {
  try {
    // TODO: add auto block, if needed
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  // hopefully forward compatible button decoration
  decorateButtons(main);
  decorateIcons(main);
  decorateDeliveryImages(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  const main = doc.querySelector('main');
  await loadSections(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadHeader(doc.querySelector('header'));
  loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();
