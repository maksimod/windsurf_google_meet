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
// Store the timestamp of the last activity to detect new phrases
let lastActivityTime = 0;
// The time threshold (in ms) to consider a subtitle as a continuation
const CONTINUATION_THRESHOLD = 1500;
// The time threshold (in ms) to consider a new phrase has started
const NEW_PHRASE_THRESHOLD = 3000;
// Flag to track if we're in an active speech segment
let activeSpeech = false;
// Store the current speaker's phrases
let currentSpeakerPhrases = [];

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
  setInterval(checkForSubtitles, 500);
  
  // Check for speech pauses to detect new phrases
  setInterval(checkForNewPhrase, 1000);
}

/**
 * Checks if enough time has passed to consider the current speech as finished
 * and a new phrase is starting
 */
function checkForNewPhrase() {
  const currentTime = Date.now();
  
  // If we have an active speech and enough time has passed since the last activity,
  // consider this as the end of a phrase
  if (activeSpeech && (currentTime - lastActivityTime > NEW_PHRASE_THRESHOLD)) {
    activeSpeech = false;
    currentSpeakerPhrases = [];
  }
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
 * Determines if the current subtitle is likely from a new speaker
 * @param {string} subtitle - The current subtitle text
 * @returns {boolean} - True if it's likely a new speaker
 */
function isLikelyNewSpeaker(subtitle) {
  // If we have no previous phrases, it's a new speaker
  if (currentSpeakerPhrases.length === 0) return true;
  
  // If the new subtitle doesn't contain any part of the previous phrases,
  // it's likely a new speaker
  for (const phrase of currentSpeakerPhrases) {
    if (subtitle.includes(phrase)) return false;
  }
  
  return true;
}

/**
 * Processes a subtitle and decides whether to display it as a new phrase or continuation
 * @param {string} subtitle - The subtitle text
 */
function processSubtitle(subtitle) {
  const currentTime = Date.now();
  
  // If this is exactly the same as the last subtitle, just update the timestamp
  if (subtitle === lastSubtitle) {
    lastActivityTime = currentTime;
    return;
  }
  
  // Check if this is a continuation of the previous subtitle
  const isContinuation = subtitle.startsWith(lastSubtitle) && 
                         (currentTime - lastSubtitleTime < CONTINUATION_THRESHOLD);
  
  // Check if we should start a new phrase based on timing and content
  const isNewPhrase = !activeSpeech || 
                     (currentTime - lastActivityTime > NEW_PHRASE_THRESHOLD) || 
                     isLikelyNewSpeaker(subtitle);
  
  // If it's a new phrase, print a blank line to separate it visually
  if (isNewPhrase && lastSubtitle) {
    console.log('');
    currentSpeakerPhrases = [];
  }
  
  // Output the subtitle to the console without any empty lines between continuations
  console.log(subtitle);
  
  // Update tracking variables
  lastSubtitle = subtitle;
  lastSubtitleTime = currentTime;
  lastActivityTime = currentTime;
  activeSpeech = true;
  
  // Keep track of this phrase for the current speaker
  if (!currentSpeakerPhrases.includes(subtitle)) {
    currentSpeakerPhrases.push(subtitle);
  }
}

// Initialize the extension when the page is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSubtitleObserver);
} else {
  initSubtitleObserver();
}
