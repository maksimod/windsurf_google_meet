/**
 * Google Meet Subtitle Extractor
 * 
 * This extension extracts and displays Google Meet subtitles in the console with
 * guaranteed phrase separation.
 */

// Configuration
const DEBUG_MODE = true;           // Enable debug logging
const NO_CHANGE_LIMIT = 5;        // Number of stable updates before considering a new phrase
const MIN_CHANGE_LENGTH = 10;     // Minimum length of change to force a new phrase

// Tracking variables
let lastText = '';                // Last subtitle text seen
let lastDisplayedText = '';      // Last text that was output to console
let noChangeCount = 0;           // Counter for times text hasn't changed
let sentenceEndDetected = false; // Flag for detecting sentence endings (periods, etc)

// Debug logging function
function debugLog(message, type = 'info') {
  if (!DEBUG_MODE) return;
  
  let style = 'font-weight: bold;';
  
  switch (type) {
    case 'error':
      style += 'color: red;';
      break;
    case 'warning':
      style += 'color: orange;';
      break;
    case 'success':
      style += 'color: green;';
      break;
    case 'info':
    default:
      style += 'color: blue;';
      break;
  }
  
  console.log(`%c[DEBUG] ${message}`, style);
}

/**
 * Initialize the subtitle extraction
 */
function init() {
  // Reset tracking variables
  lastText = '';
  lastDisplayedText = '';
  noChangeCount = 0;
  sentenceEndDetected = false;
  
  debugLog('Subtitle Extractor Initialized - MANUAL PHRASE SEPARATION MODE', 'success');
  
  // Set up mutation observer to detect subtitle changes
  const observer = new MutationObserver(findSubtitles);
  observer.observe(document.body, { childList: true, subtree: true });
  
  // Look for subtitles periodically
  setInterval(findSubtitles, 300);
}

/**
 * Find subtitle elements in the page
 */
function findSubtitles() {
  // List of possible selectors for Google Meet subtitle elements
  const selectors = [
    '[jsname="tgaKEf"]',          // Primary selector
    '.VIpgJd-yAWNEb-VIpgJd-fmcmS',   // Alternative selector
    '.CNusmb',                      // Another alternative
    '.a4cQT',                       // Additional selector
    '.TBMuR',                       // Another possible selector
    '[jscontroller="QEg9te"]'     // Controller-based selector
  ];
  
  // Try each selector until we find subtitles
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      // Process each subtitle element we found
      for (const element of elements) {
        if (element && element.textContent) {
          const text = element.textContent.trim();
          if (text) {
            processSubtitle(text);
          }
        }
      }
      return; // Stop once we've processed elements
    }
  }
}

/**
 * Process a subtitle text update
 */
function processSubtitle(text) {
  // Skip if text is identical to what we've already seen
  if (text === lastText) {
    // Count consecutive times with no change
    noChangeCount++;
    
    // If text hasn't changed for a while, this could be the end of a phrase
    if (noChangeCount >= NO_CHANGE_LIMIT) {
      // Only log occasionally to avoid spam
      if (noChangeCount === NO_CHANGE_LIMIT || noChangeCount % 10 === 0) {
        debugLog(`Text stable for ${noChangeCount} checks: '${text}'`, 'warning');
      }
      
      // After significant stability, consider the current phrase complete
      if (!sentenceEndDetected && text.match(/[.!?]\s*$/)) {
        sentenceEndDetected = true;
        debugLog('Sentence ending detected!', 'error');
      }
    }
    return;
  }
  
  // Text has changed, reset the no-change counter
  noChangeCount = 0;
  
  // Log what changed
  if (lastText) {
    // Check what kind of change happened
    if (text.startsWith(lastText)) {
      // Text grew (normal case during speech)
      debugLog(`Text extended: '${lastText}' → '${text}'`, 'success');
    } else if (lastText.startsWith(text)) {
      // Text shortened (unusual)
      debugLog(`Text shortened: '${lastText}' → '${text}'`, 'warning');
    } else {
      // Text completely changed (likely a new phrase)
      debugLog(`Text changed completely: '${lastText}' → '${text}'`, 'error');
      sentenceEndDetected = true;
    }
  } else {
    // First text we've seen
    debugLog(`Initial text: '${text}'`, 'success');
  }
  
  // Check for large changes that suggest a new phrase
  if (lastText && text.length > lastText.length + MIN_CHANGE_LENGTH) {
    debugLog(`Large text addition detected (+${text.length - lastText.length} chars)`, 'warning');
  }
  
  // Update our tracking variables
  const needsDisplay = shouldDisplayNewText(text);
  lastText = text;
  
  // Display the subtitle if needed
  if (needsDisplay) {
    displaySubtitle(text);
  }
}

/**
 * Determine if we should display this text as a new phrase
 */
function shouldDisplayNewText(text) {
  // If no previous display, always show this one
  if (!lastDisplayedText) {
    return true;
  }
  
  // If text is identical to last displayed, skip it
  if (text === lastDisplayedText) {
    return false;
  }
  
  // If we detected a sentence ending or a completely new phrase has started
  if (sentenceEndDetected) {
    return true;
  }
  
  // Text has grown since last display - only show if significant change
  if (text.startsWith(lastDisplayedText)) {
    // Show if text has grown by at least 5 characters
    return (text.length >= lastDisplayedText.length + 5);
  }
  
  // Always show if text has changed completely
  return true;
}

/**
 * Display a subtitle phrase in the console
 */
function displaySubtitle(text) {
  // Extract just the new content if this is an update to previous phrase
  let outputText = text;
  
  // If text is a continuation and not a new phrase
  if (!sentenceEndDetected && lastDisplayedText && text.startsWith(lastDisplayedText)) {
    // We're just updating the current phrase - show full text
    debugLog('Updating current phrase', 'info');
  } 
  // If this is a new phrase after a sentence end
  else if (sentenceEndDetected) {
    // Add a separator for the new phrase
    console.log('');
    console.log('%c▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃ NEW PHRASE ▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃', 'color: red; font-weight: bold; font-size: 16px; background-color: yellow;');
    console.log('');
    
    debugLog('New phrase started', 'success');
    
    // Try to extract just the new part after the previous phrase
    if (lastDisplayedText && text.startsWith(lastDisplayedText)) {
      outputText = text.substring(lastDisplayedText.length).trim();
      if (outputText) {
        debugLog(`Extracted new content: '${outputText}'`, 'success');
      } else {
        outputText = text;
      }
    }
    
    // Reset the sentence end detector
    sentenceEndDetected = false;
  }
  
  // Output the text
  console.log(outputText);
  
  // Update last displayed text
  lastDisplayedText = text;
}

// Initialize the extension
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
