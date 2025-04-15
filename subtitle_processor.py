#!/usr/bin/env python3
"""
Google Meet Subtitle Processor

This script implements an algorithm for processing Google Meet subtitles with
intelligent phrase separation based on timing and text differences.

The system processes incoming subtitle text, detects natural pauses in speech,
and outputs well-formatted phrases to the console.
"""

import time
import difflib
import sqlite3
import json
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Union

class SubtitleProcessor:
    """
    Main class for processing subtitles with intelligent phrase separation
    """
    
    def __init__(self, use_sqlite: bool = True, db_path: str = ":memory:", debug: bool = True):
        """
        Initialize the subtitle processor
        
        Args:
            use_sqlite: Whether to use SQLite (True) or in-memory storage (False)
            db_path: Path to SQLite database or ":memory:" for in-memory database
            debug: Enable debug logging
        """
        self.debug = debug
        self.use_sqlite = use_sqlite
        self.db_path = db_path
        
        # Internal state tracking
        self.last_update_time = time.time()
        self.current_phrase = ""
        self.phrase_history = []
        
        # Connection to database
        if self.use_sqlite:
            self._setup_database()
        else:
            # In-memory storage
            self.text_db = {"full_text": ""}
        
        self.debug_log("Subtitle Processor initialized")
    
    def _setup_database(self) -> None:
        """Set up the SQLite database for subtitle storage"""
        self.conn = sqlite3.connect(self.db_path)
        self.cursor = self.conn.cursor()
        
        # Create tables if they don't exist
        self.cursor.execute('''
        CREATE TABLE IF NOT EXISTS subtitles (
            id INTEGER PRIMARY KEY,
            full_text TEXT,
            timestamp REAL
        )
        ''')
        
        self.cursor.execute('''
        CREATE TABLE IF NOT EXISTS phrases (
            id INTEGER PRIMARY KEY,
            text TEXT,
            start_time REAL,
            end_time REAL
        )
        ''')
        
        self.conn.commit()
    
    def _save_to_db(self, text: str) -> None:
        """Save the current full text to the database"""
        timestamp = time.time()
        
        if self.use_sqlite:
            self.cursor.execute(
                "INSERT INTO subtitles (full_text, timestamp) VALUES (?, ?)",
                (text, timestamp)
            )
            self.conn.commit()
        else:
            # In-memory storage
            self.text_db["full_text"] = text
            self.text_db["timestamp"] = timestamp
    
    def _get_latest_text(self) -> str:
        """Get the latest full text from the database"""
        if self.use_sqlite:
            self.cursor.execute(
                "SELECT full_text FROM subtitles ORDER BY timestamp DESC LIMIT 1"
            )
            result = self.cursor.fetchone()
            return result[0] if result else ""
        else:
            # In-memory storage
            return self.text_db.get("full_text", "")
    
    def _save_phrase(self, text: str, start_time: float, end_time: float) -> None:
        """Save a completed phrase to the database"""
        if self.use_sqlite:
            self.cursor.execute(
                "INSERT INTO phrases (text, start_time, end_time) VALUES (?, ?, ?)",
                (text, start_time, end_time)
            )
            self.conn.commit()
        else:
            # Add to phrase history
            self.phrase_history.append({
                "text": text,
                "start_time": start_time,
                "end_time": end_time
            })
    
    def debug_log(self, message: str, level: str = "info") -> None:
        """Print debug messages if debug mode is enabled"""
        if not self.debug:
            return
        
        timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        
        # Color codes for different log levels
        colors = {
            "info": "\033[94m",  # Blue
            "success": "\033[92m",  # Green
            "warning": "\033[93m",  # Yellow
            "error": "\033[91m"  # Red
        }
        
        reset = "\033[0m"
        color = colors.get(level, colors["info"])
        
        print(f"{color}[DEBUG {timestamp}] {message}{reset}")
    
    def find_diff(self, old_text: str, new_text: str) -> str:
        """
        Find the difference between old and new text
        
        Uses difflib to identify what content was added
        """
        if not old_text:
            return new_text
        
        # Try to find the added text
        matcher = difflib.SequenceMatcher(None, old_text, new_text)
        
        # Get the longest matching block at the start
        match = matcher.find_longest_match(0, len(old_text), 0, len(new_text))
        
        # If there's a match at the beginning and new_text is longer
        if match.a == 0 and match.b == 0 and len(new_text) > len(old_text):
            # The diff is the new content at the end
            diff = new_text[len(old_text):]
            return diff
        
        # Complex change - do more detailed diff analysis
        diff_blocks = []
        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == 'insert' or tag == 'replace':
                diff_blocks.append(new_text[j1:j2])
        
        # Join all the new/changed blocks
        return ''.join(diff_blocks)
    
    def clean_duplicates(self, text: str) -> str:
        """Remove repeated phrases that might occur due to corrections"""
        # Simple duplicate removal for now
        # This could be enhanced with more sophisticated NLP later
        words = text.split()
        if len(words) <= 3:
            return text
        
        # Check for repeated 3-word sequences
        cleaned = []
        i = 0
        while i < len(words):
            if i + 3 <= len(words):
                chunk = ' '.join(words[i:i+3])
                remaining = ' '.join(words[i+3:])
                
                if chunk in remaining:
                    # Skip this chunk as it appears later
                    i += 3
                    continue
            
            cleaned.append(words[i])
            i += 1
        
        return ' '.join(cleaned)
    
    def process_subtitle(self, current_text: str) -> None:
        """
        Process a new subtitle update
        
        Args:
            current_text: Current full text of subtitles from Google Meet
        """
        # Get the last stored state
        last_stored_text = self._get_latest_text()
        
        # If no change, do nothing
        if current_text == last_stored_text:
            return
        
        # Current time
        update_time = time.time()
        
        # Calculate time since last update
        delta_time = update_time - self.last_update_time
        
        # Calculate the difference between texts
        diff_text = self.find_diff(last_stored_text, current_text)
        
        # Clean up potential duplicates
        diff_text = self.clean_duplicates(diff_text)
        
        # If the diff is empty or just whitespace, skip this update
        if not diff_text.strip():
            return
        
        self.debug_log(f"Detected change after {delta_time:.2f}s: '{diff_text}'", 
                      "success" if delta_time < 2 else "warning")
        
        # Determine if this is a continuation or a new phrase
        if delta_time < 2.0:
            # Continue current phrase
            if self.current_phrase:
                # If diff_text seems to be a correction of the current phrase
                if self.current_phrase in current_text:
                    # Current phrase is still valid, append the new content
                    self.current_phrase += diff_text
                else:
                    # Current text doesn't contain our phrase, might be a correction
                    # Take the best approach - use the current_text as is
                    self.current_phrase = current_text
            else:
                # Start a new phrase
                self.current_phrase = diff_text
            
            # Update console (overwrite last line)
            print(f"\r{self.current_phrase}", end="", flush=True)
        else:
            # Time gap detected - this is a new phrase
            if self.current_phrase:
                # Complete the current phrase
                print("\n")  # Ensure we're on a new line
                self._save_phrase(
                    self.current_phrase, 
                    self.last_update_time, 
                    update_time
                )
            
            # Start a new phrase
            self.current_phrase = diff_text
            
            # Print separator for new phrases
            print("\n" + "▃" * 20 + " NEW PHRASE " + "▃" * 20)
            print(self.current_phrase)
        
        # Update state
        self._save_to_db(current_text)
        self.last_update_time = update_time
    
    def close(self) -> None:
        """Clean up resources"""
        if self.use_sqlite:
            self.conn.close()


class GoogleMeetSubtitleExtractor:
    """
    Mock class for demonstration purposes
    
    In a real implementation, this would interface with Google Meet
    to extract subtitles in real-time.
    """
    
    def __init__(self, processor: SubtitleProcessor):
        self.processor = processor
        self.subtitles = []
        self.current_text = ""
    
    def on_subtitle_update(self, text: str) -> None:
        """
        Handle a subtitle update from Google Meet
        
        In a real implementation, this would be called by a browser extension
        or other mechanism that extracts subtitles from Google Meet.
        """
        self.current_text = text
        self.processor.process_subtitle(text)


def demo():
    """
    Demonstrate the subtitle processor with simulated input
    """
    processor = SubtitleProcessor(use_sqlite=False, debug=True)
    extractor = GoogleMeetSubtitleExtractor(processor)
    
    # Simulate a series of subtitle updates with realistic timing
    updates = [
        "Hello, welcome to the meeting.",
        "Hello, welcome to the meeting. Today we're going to discuss",
        "Hello, welcome to the meeting. Today we're going to discuss the project timeline.",
        "Hello, welcome to the meeting. Today we're going to discuss the project timeline. First,",
        "Hello, welcome to the meeting. Today we're going to discuss the project timeline. First, let's review our progress.",
    ]
    
    for update in updates:
        extractor.on_subtitle_update(update)
        time.sleep(0.5)  # Simulate short updates
    
    # Simulate a pause and a new phrase
    time.sleep(2.5)
    
    more_updates = [
        "Does anyone have questions about the timeline?",
        "Does anyone have questions about the timeline? We need to finalize it today.",
        "Does anyone have questions about the timeline? We need to finalize it today. I know it's tight.",
    ]
    
    for update in more_updates:
        extractor.on_subtitle_update(update)
        time.sleep(0.8)
    
    # Cleanup
    processor.close()


if __name__ == "__main__":
    print("Google Meet Subtitle Processor Demo")
    print("===================================")
    demo()
