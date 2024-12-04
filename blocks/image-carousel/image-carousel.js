import { mergeImagesForArtDirection } from '../../scripts/scripts.js';

function startCarousel(carousel, imageContainer, totalImages) {
  const intervalTime = 2000; // Time in milliseconds
  let autoScrollInterval;
  let currentIndex = 0;

  function updateDots() {
    const dots = document.querySelectorAll('.dot');
    dots.forEach((dot, index) => {
      dot.classList.toggle('active', index === currentIndex);
    });
  }

  function updateCarousel() {
    imageContainer.style.transform = `translateX(-${currentIndex * 100}%)`;
    updateDots();
  }

  function slideToNextImage() {
    currentIndex = (currentIndex + 1) % totalImages;
    updateCarousel();
  }

  function resetAutoScroll() {
    clearInterval(autoScrollInterval);
    autoScrollInterval = setInterval(slideToNextImage, intervalTime);
  }

  function moveToImage(index) {
    currentIndex = index;
    updateCarousel();
    resetAutoScroll();
  }

  const dots = document.querySelectorAll('.dot');
  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => moveToImage(index));
  });
  autoScrollInterval = setInterval(slideToNextImage, intervalTime);
}

export default async function decorate(block) {
  const imageContainer = document.createElement('div');
  imageContainer.classList.add('image-container');
  const dotsContainer = document.createElement('div');
  dotsContainer.classList.add('dots-container');
  const images = [...block.children];
  const totalImages = images.length;
  images.forEach((imgDiv, index) => {
    const pictureElements = imgDiv.querySelectorAll('picture');
    if (pictureElements.length >= 2) {
      const imgDesktop = pictureElements[0].querySelector('img');
      const imgMobile = pictureElements[0].querySelector('img');
      mergeImagesForArtDirection(imgDesktop, imgMobile);
    }

    imageContainer.appendChild(imgDiv);
    // Create dot for each image
    const dot = document.createElement('span');
    dot.classList.add('dot');
    if (index === 0) dot.classList.add('active');

    dotsContainer.appendChild(dot);
  });

  block.innerHTML = '';
  block.appendChild(imageContainer);
  block.appendChild(dotsContainer);

  if (document.documentElement.className.indexOf('adobe-ue-') < 0) {
    startCarousel(block, imageContainer, totalImages);
  }
}
