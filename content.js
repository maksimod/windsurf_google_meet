/**
 * Google Meet Subtitle Extractor
 * 
 * This extension extracts and displays Google Meet subtitles in the console,
 * only showing the difference between updates and separating phrases when speech pauses.
 */

// Store the previous subtitle text
let previousText = '';

// Store the timestamp of the last subtitle update
let lastUpdateTime = 0;

// The time threshold (in ms) to consider a new phrase has started
const NEW_PHRASE_THRESHOLD = 2000;

// Flag to track if we're in a new phrase (after a pause)
let isNewPhrase = true;

/**
 * Initializes the subtitle observer
 */
function initSubtitleObserver() {
  console.log('Google Meet Subtitle Extractor initialized');
  
  // Create a mutation observer to detect when subtitles appear
  const observer = new MutationObserver(() => {
    checkForSubtitles();
  });

  // Start observing the document for subtitle container changes
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Check periodically for subtitles
  setInterval(checkForSubtitles, 300);
  
  // Check for speech pauses to detect new phrases
  setInterval(checkForSpeechPause, 500);
}

/**
 * Checks if enough time has passed since the last subtitle update
 * to consider the next subtitle as a new phrase
 */
function checkForSpeechPause() {
  const currentTime = Date.now();
  
  // If enough time has passed since the last update, mark the next subtitle as a new phrase
  if (previousText && (currentTime - lastUpdateTime > NEW_PHRASE_THRESHOLD)) {
    isNewPhrase = true;
  }
}

/**
 * Checks for subtitle elements and processes them
 */
function checkForSubtitles() {
  // Try multiple selectors to find subtitle elements
  const subtitleSelectors = [
    '[jsname="tgaKEf"]',          // Primary selector
    '.VIpgJd-yAWNEb-VIpgJd-fmcmS',   // Alternative selector
    '.CNusmb',                      // Another alternative
    '.a4cQT',                       // Additional selector
    '.TBMuR',                       // Another possible selector
    '[jscontroller="QEg9te"]'     // Controller-based selector
  ];
  
  // Try each selector until we find subtitle elements
  for (const selector of subtitleSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      processSubtitleElements(elements);
      break; // Stop once we've found and processed elements
    }
  }
}

/**
 * Processes subtitle elements and extracts their text
 * @param {NodeList} elements - The subtitle elements
 */
function processSubtitleElements(elements) {
  for (const element of elements) {
    if (element && element.textContent) {
      const text = element.textContent.trim();
      
      // Skip empty subtitles
      if (!text) continue;
      
      // Process the subtitle text
      processSubtitle(text);
    }
  }
}

/**
 * Processes a subtitle and outputs only the difference from the previous subtitle
 * @param {string} text - The subtitle text
 */
function processSubtitle(text) {
  const currentTime = Date.now();
  
  // If this is exactly the same as before, just update the timestamp and skip output
  if (text === previousText) {
    lastUpdateTime = currentTime;
    return;
  }
  
  // If this is a new phrase (after a pause)
  if (isNewPhrase) {
    // Output the entire text as a new phrase
    console.log(text);
    isNewPhrase = false;
  } 
  // If this is a continuation of the previous text
  else if (previousText && text.startsWith(previousText)) {
    // Only output the difference (what was added)
    const difference = text.substring(previousText.length);
    if (difference.trim()) {
      console.log(difference);
    }
  }
  // If this is a completely different text (not a continuation)
  else {
    // Output the entire text
    console.log(text);
  }
  
  // Update tracking variables
  previousText = text;
  lastUpdateTime = currentTime;
}

// Initialize the extension when the page is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSubtitleObserver);
} else {
  initSubtitleObserver();
}
