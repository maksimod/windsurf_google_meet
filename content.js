/**
 * Google Meet Subtitle Extractor
 * 
 * This extension extracts and displays Google Meet subtitles in the console,
 * using persistent storage to track and display only new content.
 */

// Database to store subtitle information
class SubtitleDatabase {
  constructor() {
    // Current raw subtitle text from Google Meet
    this.currentText = '';
    
    // Last time subtitles were updated
    this.lastUpdateTime = Date.now();
    
    // Complete history of subtitles for the current session
    this.subtitleHistory = [];
    
    // Current phrase being built
    this.currentPhrase = '';
    
    // All phrases that have been detected
    this.phrases = [];
    
    // Words that have already been output to console
    this.outputWords = new Set();
    
    // Flag to indicate if we're starting a new phrase
    this.isNewPhrase = true;
  }
  
  // Reset the database for a new session
  reset() {
    this.currentText = '';
    this.lastUpdateTime = Date.now();
    this.subtitleHistory = [];
    this.currentPhrase = '';
    this.phrases = [];
    this.outputWords = new Set();
    this.isNewPhrase = true;
  }
  
  // Add a new subtitle and get what should be output
  processSubtitle(text) {
    // If the text is the same, just update the timestamp
    if (text === this.currentText) {
      this.lastUpdateTime = Date.now();
      return null;
    }
    
    // Add to history
    this.subtitleHistory.push({
      text: text,
      timestamp: Date.now()
    });
    
    // Determine what to output
    let outputText = null;
    
    // If this is a new phrase after a pause
    if (this.isNewPhrase) {
      // Start a new phrase with the full text
      this.currentPhrase = text;
      outputText = text;
      this.isNewPhrase = false;
      
      // Add all words to the output set
      this.addWordsToOutputSet(text);
    } 
    // If this is a continuation of the current phrase
    else {
      // Find the new words that haven't been output yet
      outputText = this.findNewWords(text);
      
      // Update the current phrase
      this.currentPhrase = text;
    }
    
    // Update the current text and timestamp
    this.currentText = text;
    this.lastUpdateTime = Date.now();
    
    return outputText;
  }
  
  // Check if enough time has passed to consider the next subtitle a new phrase
  checkForNewPhrase(threshold) {
    const currentTime = Date.now();
    if (this.currentText && (currentTime - this.lastUpdateTime > threshold)) {
      // If we have a current phrase, add it to the phrases list
      if (this.currentPhrase) {
        this.phrases.push(this.currentPhrase);
      }
      
      // Mark that the next subtitle will be a new phrase
      this.isNewPhrase = true;
      return true;
    }
    return false;
  }
  
  // Add all words in a text to the output set
  addWordsToOutputSet(text) {
    // Split the text into words and add each to the set
    const words = this.splitIntoWords(text);
    for (const word of words) {
      if (word.trim()) {
        this.outputWords.add(word.trim().toLowerCase());
      }
    }
  }
  
  // Split text into words
  splitIntoWords(text) {
    // Split by spaces, but keep punctuation with words
    return text.split(/\s+/);
  }
  
  // Find new words in the text that haven't been output yet
  findNewWords(text) {
    // If the current phrase is empty, return the full text
    if (!this.currentPhrase) {
      return text;
    }
    
    // If the text starts with the current phrase, it's a simple continuation
    if (text.startsWith(this.currentPhrase)) {
      const newPart = text.substring(this.currentPhrase.length).trim();
      if (newPart) {
        this.addWordsToOutputSet(newPart);
        return newPart;
      }
      return null;
    }
    
    // Try to find words that haven't been output yet
    const words = this.splitIntoWords(text);
    const newWords = [];
    
    for (const word of words) {
      const cleanWord = word.trim().toLowerCase();
      if (cleanWord && !this.outputWords.has(cleanWord)) {
        newWords.push(word);
        this.outputWords.add(cleanWord);
      }
    }
    
    // If we found new words, join them and return
    if (newWords.length > 0) {
      return newWords.join(' ');
    }
    
    // If we couldn't find new words but the text is different,
    // something changed that we couldn't detect precisely
    if (text !== this.currentPhrase) {
      // Try to find the point where the texts diverge
      let i = 0;
      while (i < Math.min(text.length, this.currentPhrase.length) && 
             text.charAt(i) === this.currentPhrase.charAt(i)) {
        i++;
      }
      
      // If we found a divergence point, extract from there
      if (i < text.length) {
        // Find the start of the word where divergence occurs
        while (i > 0 && text.charAt(i - 1) !== ' ') {
          i--;
        }
        
        const newPart = text.substring(i).trim();
        if (newPart) {
          this.addWordsToOutputSet(newPart);
          return newPart;
        }
      }
    }
    
    return null;
  }
}

// Create the subtitle database
const subtitleDB = new SubtitleDatabase();

// The time threshold (in ms) to consider a new phrase has started
const NEW_PHRASE_THRESHOLD = 2000;

/**
 * Initializes the subtitle observer
 */
function initSubtitleObserver() {
  console.log('Google Meet Subtitle Extractor initialized');
  
  // Reset the database
  subtitleDB.reset();
  
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
  setInterval(() => {
    subtitleDB.checkForNewPhrase(NEW_PHRASE_THRESHOLD);
  }, 500);
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
      
      // Process the subtitle text and output if there's something new
      const outputText = subtitleDB.processSubtitle(text);
      if (outputText) {
        console.log(outputText);
      }
    }
  }
}

// Initialize the extension when the page is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSubtitleObserver);
} else {
  initSubtitleObserver();
}

// Initialize the extension when the page is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSubtitleObserver);
} else {
  initSubtitleObserver();
}
