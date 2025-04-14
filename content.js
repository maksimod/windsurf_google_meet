/**
 * Google Meet Subtitle Extractor
 * 
 * This extension extracts and displays Google Meet subtitles in the console,
 * separating them into phrases according to the specified requirements.
 */

// Store the last displayed subtitle to avoid duplicates
let lastSubtitle = '';
// Store the timestamp of the last subtitle to determine if it's a continuation
let lastSubtitleTime = 0;
// The time threshold (in ms) to consider a subtitle as a continuation
const CONTINUATION_THRESHOLD = 1500;

/**
 * Initializes the subtitle observer
 */
function initSubtitleObserver() {
  console.log('Google Meet Subtitle Extractor initialized');
  
  // Create a mutation observer to detect when subtitles appear
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        checkForSubtitles();
      }
    }
  });

  // Start observing the document for subtitle container changes
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Also check periodically in case we miss some mutations
  setInterval(checkForSubtitles, 1000);
}

/**
 * Checks for subtitle elements and processes them
 */
function checkForSubtitles() {
  // Google Meet subtitles are typically in elements with specific attributes
  // This selector might need adjustment based on Google Meet's current DOM structure
  const subtitleElements = document.querySelectorAll('[jsname="tgaKEf"], .VIpgJd-yAWNEb-VIpgJd-fmcmS, .CNusmb');
  
  if (subtitleElements.length > 0) {
    processSubtitleElements(subtitleElements);
  }
}

/**
 * Processes subtitle elements and extracts their text
 * @param {NodeList} elements - The subtitle elements
 */
function processSubtitleElements(elements) {
  for (const element of elements) {
    if (element && element.textContent) {
      const currentText = element.textContent.trim();
      
      // Skip empty subtitles
      if (!currentText) continue;
      
      // Process the subtitle
      processSubtitle(currentText);
    }
  }
}

/**
 * Processes a subtitle and decides whether to display it as a new phrase or continuation
 * @param {string} subtitle - The subtitle text
 */
function processSubtitle(subtitle) {
  const currentTime = Date.now();
  
  // If this is exactly the same as the last subtitle, skip it
  if (subtitle === lastSubtitle) return;
  
  // Check if this is a continuation of the previous subtitle
  const isContinuation = subtitle.startsWith(lastSubtitle) && 
                         (currentTime - lastSubtitleTime < CONTINUATION_THRESHOLD);
  
  // If it's a new phrase (not a continuation), add a line break before it
  if (!isContinuation && lastSubtitle) {
    console.log('');
  }
  
  // Output the subtitle to the console
  console.log(subtitle);
  
  // Update the last subtitle and timestamp
  lastSubtitle = subtitle;
  lastSubtitleTime = currentTime;
}

// Initialize the extension when the page is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSubtitleObserver);
} else {
  initSubtitleObserver();
}
