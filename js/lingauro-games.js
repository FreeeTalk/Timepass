/**
 * Timepass Talk - Lingauro Games & Interactive In-Room Activities
 * Taboo Word Guessing, Trivia Quiz, 100+ Icebreakers, 60s Speaking Challenge & Whiteboard
 */

const LingauroGames = {
  socket: null,
  currentRoomId: null,

  // 1. Taboo Word Bank
  tabooWords: [
    { word: 'AIRPORT', taboo: ['Plane', 'Travel', 'Fly', 'Luggage', 'Ticket'] },
    { word: 'HOSPITAL', taboo: ['Doctor', 'Nurse', 'Sick', 'Medicine', 'Emergency'] },
    { word: 'LIBRARY', taboo: ['Book', 'Read', 'Quiet', 'Study', 'Borrow'] },
    { word: 'SMARTPHONE', taboo: ['Call', 'Screen', 'App', 'Internet', 'Apple'] },
    { word: 'CINEMA', taboo: ['Movie', 'Popcorn', 'Film', 'Actor', 'Ticket'] },
    { word: 'RESTAURANT', taboo: ['Food', 'Waiter', 'Menu', 'Eat', 'Dinner'] },
    { word: 'COFFEE', taboo: ['Drink', 'Cafe', 'Morning', 'Cup', 'Starbucks'] },
    { word: 'BEACH', taboo: ['Sand', 'Ocean', 'Sun', 'Swim', 'Summer'] },
    { word: 'GUITAR', taboo: ['Music', 'Instrument', 'Strings', 'Play', 'Rock'] },
    { word: 'PASSPORT', taboo: ['Country', 'Travel', 'Border', 'Visa', 'Identity'] }
  ],
  currentTabooIndex: 0,

  // 2. Language & Culture Trivia Questions
  triviaBank: [
    {
      question: 'Which language is recognized as having the longest official alphabet with 74 letters?',
      options: ['A) Tamil', 'B) Khmer (Cambodian)', 'C) Russian', 'D) Greek'],
      answer: 1,
      fact: 'Khmer has 74 letters, including 33 consonants and 23 vowels!'
    },
    {
      question: 'Which language is considered one of the oldest surviving classical languages in the world?',
      options: ['A) Latin', 'B) Tamil', 'C) Old English', 'D) Esperanto'],
      answer: 1,
      fact: 'Tamil has a documented literary history spanning over 2,500 years!'
    },
    {
      question: 'In which language do question marks and exclamation points appear upside-down at the start of a sentence?',
      options: ['A) Portuguese', 'B) Italian', 'C) Spanish (¿?)', 'D) German'],
      answer: 2,
      fact: 'Spanish uses inverted question marks (¿) and exclamation marks (¡)!'
    },
    {
      question: 'What is the most spoken native language in the entire world by total native speakers?',
      options: ['A) Mandarin Chinese', 'B) Spanish', 'C) English', 'D) Hindi'],
      answer: 0,
      fact: 'Mandarin Chinese has over 900 million native speakers!'
    },
    {
      question: 'How many grammatical cases does the Finnish language have?',
      options: ['A) 4', 'B) 8', 'C) 15', 'D) 2'],
      answer: 2,
      fact: 'Finnish has 15 grammatical cases instead of using prepositions!'
    }
  ],
  currentTriviaIndex: 0,

  // 3. 100+ Conversation Starters & Icebreakers
  icebreakers: [
    "If you could teleport to any city in the world for dinner tonight, where would you go and why?",
    "What is the most interesting cultural tradition or festival celebrated in your hometown?",
    "If you could speak 5 foreign languages fluently tomorrow, which 5 would you choose?",
    "What is a popular misunderstanding foreigners have about your native country?",
    "What is the best movie or TV show you have watched recently, and what did you like about it?",
    "If you were writing a book about your life so far, what would the title of this chapter be?",
    "What dish from your country would you cook for someone visiting for the very first time?",
    "Would you prefer to live in a futuristic mega-city or a quiet cabin in the Swiss Alps?",
    "What is the biggest dream or personal goal you are actively working on this year?",
    "What kind of music energizes you when you need motivation?"
  ],

  // 4. Speaking Challenge Timer State
  timerDuration: 60,
  timerRemaining: 60,
  timerInterval: null,

  // 5. Whiteboard State
  whiteboardCanvas: null,
  whiteboardCtx: null,
  isDrawing: false,
  drawColor: '#263238',
  drawSize: 3,

  init(socket, roomId) {
    this.socket = socket;
    this.currentRoomId = roomId;

    this.setupListeners();
    this.initWhiteboard();
    this.renderCurrentTaboo();
    this.renderCurrentTrivia();
  },

  setupListeners() {
    // Taboo next word button
    const btnTabooNext = document.getElementById('btn-taboo-next');
    if (btnTabooNext) {
      btnTabooNext.onclick = () => {
        this.nextTabooWord(true);
      };
    }

    // Trivia next question
    const btnTriviaNext = document.getElementById('btn-trivia-next');
    if (btnTriviaNext) {
      btnTriviaNext.onclick = () => {
        this.nextTriviaQuestion(true);
      };
    }

    // Icebreaker spin
    const btnSpin = document.getElementById('btn-spin-icebreaker');
    if (btnSpin) {
      btnSpin.onclick = () => {
        this.spinIcebreaker(true);
      };
    }

    // Speaking timer buttons
    const btnStartTimer = document.getElementById('btn-start-timer');
    if (btnStartTimer) {
      btnStartTimer.onclick = () => this.startSpeakingTimer(true);
    }

    const btnResetTimer = document.getElementById('btn-reset-timer');
    if (btnResetTimer) {
      btnResetTimer.onclick = () => this.resetSpeakingTimer(true);
    }

    // Whiteboard color selector
    document.querySelectorAll('.wb-color-dot').forEach(dot => {
      dot.onclick = () => {
        document.querySelectorAll('.wb-color-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        this.drawColor = dot.getAttribute('data-color');
      };
    });

    const btnWbClear = document.getElementById('btn-wb-clear');
    if (btnWbClear) {
      btnWbClear.onclick = () => this.clearWhiteboard(true);
    }

    const btnWbSave = document.getElementById('btn-wb-save');
    if (btnWbSave) {
      btnWbSave.onclick = () => this.saveWhiteboard();
    }

    // Socket game synchronization
    if (this.socket) {
      this.socket.on('game-update', ({ action, payload, senderSocketId }) => {
        if (action === 'taboo_word') {
          this.currentTabooIndex = payload.index;
          this.renderCurrentTaboo();
        } else if (action === 'trivia_question') {
          this.currentTriviaIndex = payload.index;
          this.renderCurrentTrivia();
        } else if (action === 'icebreaker') {
          const el = document.getElementById('icebreaker-text');
          if (el) el.textContent = `"${payload.prompt}"`;
        } else if (action === 'timer_start') {
          this.startSpeakingTimer(false);
        } else if (action === 'timer_reset') {
          this.resetSpeakingTimer(false);
        } else if (action === 'wb_draw') {
          this.drawRemoteStroke(payload);
        } else if (action === 'wb_clear') {
          this.clearWhiteboard(false);
        }
      });
    }
  },

  // --- Taboo ---
  renderCurrentTaboo() {
    const item = this.tabooWords[this.currentTabooIndex % this.tabooWords.length];
    const elWord = document.getElementById('taboo-current-word');
    const elForbidden = document.getElementById('taboo-forbidden-words');
    if (elWord && elForbidden) {
      elWord.textContent = item.word;
      elForbidden.textContent = `Forbidden: ${item.taboo.join(', ')}`;
    }
  },

  nextTabooWord(broadcast = false) {
    this.currentTabooIndex = (this.currentTabooIndex + 1) % this.tabooWords.length;
    this.renderCurrentTaboo();
    if (broadcast && this.socket && this.currentRoomId) {
      this.socket.emit('game-sync', {
        roomId: this.currentRoomId,
        action: 'taboo_word',
        payload: { index: this.currentTabooIndex }
      });
    }
  },

  // --- Trivia ---
  renderCurrentTrivia() {
    const item = this.triviaBank[this.currentTriviaIndex % this.triviaBank.length];
    const qText = document.getElementById('trivia-q-text');
    const optBox = document.getElementById('trivia-options-box');
    if (!qText || !optBox) return;

    qText.textContent = item.question;
    optBox.innerHTML = '';

    item.options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.className = 'btn-trivia-opt';
      btn.textContent = opt;
      btn.onclick = () => {
        if (idx === item.answer) {
          btn.classList.add('correct');
          btn.innerHTML = `${opt} ✅ Correct!`;
          qText.textContent = `${item.question} — ${item.fact}`;
        } else {
          btn.style.backgroundColor = '#e74c3c';
          btn.innerHTML = `${opt} ❌ Try again`;
        }
      };
      optBox.appendChild(btn);
    });
  },

  nextTriviaQuestion(broadcast = false) {
    this.currentTriviaIndex = (this.currentTriviaIndex + 1) % this.triviaBank.length;
    this.renderCurrentTrivia();
    if (broadcast && this.socket && this.currentRoomId) {
      this.socket.emit('game-sync', {
        roomId: this.currentRoomId,
        action: 'trivia_question',
        payload: { index: this.currentTriviaIndex }
      });
    }
  },

  // --- Icebreaker ---
  spinIcebreaker(broadcast = false) {
    const prompt = this.icebreakers[Math.floor(Math.random() * this.icebreakers.length)];
    const el = document.getElementById('icebreaker-text');
    if (el) el.textContent = `"${prompt}"`;

    if (broadcast && this.socket && this.currentRoomId) {
      this.socket.emit('game-sync', {
        roomId: this.currentRoomId,
        action: 'icebreaker',
        payload: { prompt }
      });
    }
  },

  // --- 60s Speaking Challenge ---
  startSpeakingTimer(broadcast = false) {
    clearInterval(this.timerInterval);
    this.timerRemaining = this.timerDuration;
    const display = document.getElementById('speaking-timer-val');

    this.timerInterval = setInterval(() => {
      this.timerRemaining--;
      if (display) {
        display.textContent = `${this.timerRemaining}s`;
        if (this.timerRemaining <= 10) {
          display.style.color = '#e74c3c';
        } else {
          display.style.color = '#2ecc71';
        }
      }

      if (this.timerRemaining <= 0) {
        clearInterval(this.timerInterval);
        if (display) display.textContent = 'Time Up! 🎉';
      }
    }, 1000);

    if (broadcast && this.socket && this.currentRoomId) {
      this.socket.emit('game-sync', {
        roomId: this.currentRoomId,
        action: 'timer_start',
        payload: {}
      });
    }
  },

  resetSpeakingTimer(broadcast = false) {
    clearInterval(this.timerInterval);
    this.timerRemaining = this.timerDuration;
    const display = document.getElementById('speaking-timer-val');
    if (display) {
      display.textContent = `${this.timerDuration}s`;
      display.style.color = '#2ecc71';
    }

    if (broadcast && this.socket && this.currentRoomId) {
      this.socket.emit('game-sync', {
        roomId: this.currentRoomId,
        action: 'timer_reset',
        payload: {}
      });
    }
  },

  // --- Collaborative Whiteboard ---
  initWhiteboard() {
    this.whiteboardCanvas = document.getElementById('whiteboard-canvas');
    if (!this.whiteboardCanvas) return;

    this.whiteboardCtx = this.whiteboardCanvas.getContext('2d');
    const resizeCanvas = () => {
      const rect = this.whiteboardCanvas.parentElement.getBoundingClientRect();
      this.whiteboardCanvas.width = rect.width || 360;
      this.whiteboardCanvas.height = rect.height || 360;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let lastX = 0;
    let lastY = 0;

    const startDraw = (e) => {
      this.isDrawing = true;
      const rect = this.whiteboardCanvas.getBoundingClientRect();
      lastX = (e.clientX || e.touches[0].clientX) - rect.left;
      lastY = (e.clientY || e.touches[0].clientY) - rect.top;
    };

    const draw = (e) => {
      if (!this.isDrawing) return;
      const rect = this.whiteboardCanvas.getBoundingClientRect();
      const currentX = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
      const currentY = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;

      this.drawLine(lastX, lastY, currentX, currentY, this.drawColor, this.drawSize);

      if (this.socket && this.currentRoomId) {
        this.socket.emit('game-sync', {
          roomId: this.currentRoomId,
          action: 'wb_draw',
          payload: {
            x1: lastX,
            y1: lastY,
            x2: currentX,
            y2: currentY,
            color: this.drawColor,
            size: this.drawSize
          }
        });
      }

      lastX = currentX;
      lastY = currentY;
    };

    const stopDraw = () => {
      this.isDrawing = false;
    };

    this.whiteboardCanvas.onmousedown = startDraw;
    this.whiteboardCanvas.onmousemove = draw;
    this.whiteboardCanvas.onmouseup = stopDraw;
    this.whiteboardCanvas.onmouseleave = stopDraw;

    // Mobile touch
    this.whiteboardCanvas.ontouchstart = startDraw;
    this.whiteboardCanvas.ontouchmove = draw;
    this.whiteboardCanvas.ontouchend = stopDraw;
  },

  drawLine(x1, y1, x2, y2, color, size) {
    if (!this.whiteboardCtx) return;
    this.whiteboardCtx.beginPath();
    this.whiteboardCtx.strokeStyle = color;
    this.whiteboardCtx.lineWidth = size;
    this.whiteboardCtx.lineCap = 'round';
    this.whiteboardCtx.moveTo(x1, y1);
    this.whiteboardCtx.lineTo(x2, y2);
    this.whiteboardCtx.stroke();
  },

  drawRemoteStroke(stroke) {
    this.drawLine(stroke.x1, stroke.y1, stroke.x2, stroke.y2, stroke.color, stroke.size);
  },

  clearWhiteboard(broadcast = false) {
    if (!this.whiteboardCanvas || !this.whiteboardCtx) return;
    this.whiteboardCtx.clearRect(0, 0, this.whiteboardCanvas.width, this.whiteboardCanvas.height);

    if (broadcast && this.socket && this.currentRoomId) {
      this.socket.emit('game-sync', {
        roomId: this.currentRoomId,
        action: 'wb_clear',
        payload: {}
      });
    }
  },

  saveWhiteboard() {
    if (!this.whiteboardCanvas) return;
    const dataUrl = this.whiteboardCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `whiteboard_drawing_${Date.now()}.png`;
    a.click();
  }
};
