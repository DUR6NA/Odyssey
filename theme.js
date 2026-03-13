const presetThemes = {
    'dark': {
        name: 'Dark Mode',
        type: 'standard',
        vars: {
            '--bg-main': '#000000',
            '--bg-secondary': 'rgba(15, 15, 15, 0.6)',
            '--bg-tertiary': 'rgba(10, 10, 10, 0.7)',
            '--text-main': '#a1a1aa',
            '--text-heading': '#ffffff',
            '--text-muted': '#71717a',
            '--accent-color': '#ffffff',
            '--accent-hover': '#e2e8f0',
            '--accent-active': '#d1d5db',
            '--border-color': 'rgba(255, 255, 255, 0.08)',
            '--btn-text': '#000000',
            '--input-bg': 'rgba(0, 0, 0, 0.5)',
            '--input-text': '#ffffff',
            '--color-success': '#2e7d32',
            '--color-success-hover': '#388e3c',
            '--color-danger': '#dc3545',
            '--color-danger-hover': '#c82333',
            '--color-warning': '#f57f17',
            '--color-warning-hover': '#f9a825',
            '--color-ai': '#6a1b9a',
            '--color-ai-hover': '#8e24aa',
            '--color-info': '#1976d2',
            '--color-info-hover': '#1565c0',
            '--color-secondary': '#3f3f46',
            '--color-secondary-hover': '#52525b',
            '--shadow-sm': '0 2px 8px rgba(0,0,0,0.15)',
            '--shadow-md': '0 4px 16px rgba(0,0,0,0.25)',
            '--shadow-lg': '0 8px 32px rgba(0,0,0,0.4)',
            '--shadow-xl': '0 12px 48px rgba(0,0,0,0.6)',
            '--menu-bg-top': '#02040a',
            '--menu-bg-mid': '#0b1021',
            '--menu-bg-bottom': '#131d36',
            '--menu-wave1': '#060a12',
            '--menu-wave2': '#11182c',
            '--menu-wave3': '#1a233b',
            '--menu-moon-bg': '#eef1f5',
            '--menu-moon-glow': 'rgba(238, 241, 245, 0.4)',
            '--menu-moon-inset': 'rgba(0, 0, 0, 0.2)',
            '--menu-title-color': '#ffffff',
            '--menu-btn-color': '#d1d5db',
            '--menu-btn-hover': '#ffffff',
            '--menu-show-stars': '1',
            '--menu-show-lightning': '1'
        }
    },
    'light': {
        name: 'Light Mode',
        type: 'standard',
        vars: {
            '--bg-main': '#ffffff',
            '--bg-secondary': 'rgba(230, 230, 230, 0.5)',
            '--bg-tertiary': 'rgba(255, 255, 255, 0.8)',
            '--text-main': '#333333',
            '--text-heading': '#000000',
            '--text-muted': '#666666',
            '--accent-color': '#000000',
            '--accent-hover': '#333333',
            '--accent-active': '#555555',
            '--border-color': 'rgba(0, 0, 0, 0.1)',
            '--btn-text': '#ffffff',
            '--input-bg': 'rgba(255, 255, 255, 0.9)',
            '--input-text': '#000000',
            '--color-success': '#2e7d32',
            '--color-success-hover': '#388e3c',
            '--color-danger': '#dc3545',
            '--color-danger-hover': '#c82333',
            '--color-warning': '#e65100',
            '--color-warning-hover': '#f57c00',
            '--color-ai': '#6a1b9a',
            '--color-ai-hover': '#8e24aa',
            '--color-info': '#1976d2',
            '--color-info-hover': '#1565c0',
            '--color-secondary': '#6b7280',
            '--color-secondary-hover': '#4b5563',
            '--shadow-sm': '0 2px 8px rgba(0,0,0,0.08)',
            '--shadow-md': '0 4px 16px rgba(0,0,0,0.12)',
            '--shadow-lg': '0 8px 32px rgba(0,0,0,0.16)',
            '--shadow-xl': '0 12px 48px rgba(0,0,0,0.24)',
            '--menu-bg-top': '#5ba3e0',
            '--menu-bg-mid': '#8abff0',
            '--menu-bg-bottom': '#cae8fa',
            '--menu-wave1': '#84c5f0',
            '--menu-wave2': '#439ae0',
            '--menu-wave3': '#1a74bf',
            '--menu-moon-bg': '#FFD700',
            '--menu-moon-glow': 'rgba(255, 215, 0, 0.5)',
            '--menu-moon-inset': 'rgba(255, 140, 0, 0.4)',
            '--menu-title-color': '#1a1a1a',
            '--menu-btn-color': '#333333',
            '--menu-btn-hover': '#000000',
            '--menu-show-stars': '0',
            '--menu-show-lightning': '0'
        }
    },
    'bliss': {
        name: 'Bliss',
        type: 'image',
        bgImage: 'assets/BlissBackground.jpg',
        vars: {
            '--bg-main': '#000000',
            '--bg-secondary': 'rgba(255, 255, 255, 0.15)',
            '--bg-tertiary': 'rgba(255, 255, 255, 0.3)',
            '--text-main': '#1a1a1a',
            '--text-heading': '#FFFCE0',
            '--text-muted': '#333333',
            '--accent-color': '#FFFCE0',
            '--accent-hover': '#fdf8c2',
            '--accent-active': '#fcf4a3',
            '--border-color': 'rgba(255, 255, 255, 0.3)',
            '--btn-text': '#000000',
            '--input-bg': 'rgba(255, 255, 255, 0.7)',
            '--input-text': '#000000',
            '--color-success': '#388e3c',
            '--color-success-hover': '#43a047',
            '--color-danger': '#d32f2f',
            '--color-danger-hover': '#e53935',
            '--color-warning': '#f57f17',
            '--color-warning-hover': '#f9a825',
            '--color-ai': '#7b1fa2',
            '--color-ai-hover': '#9c27b0',
            '--color-info': '#1976d2',
            '--color-info-hover': '#1e88e5',
            '--color-secondary': '#546e7a',
            '--color-secondary-hover': '#607d8b',
            '--shadow-sm': '0 2px 8px rgba(0,0,0,0.15)',
            '--shadow-md': '0 4px 16px rgba(0,0,0,0.25)',
            '--shadow-lg': '0 8px 32px rgba(0,0,0,0.4)',
            '--shadow-xl': '0 12px 48px rgba(0,0,0,0.6)',
            '--menu-bg-top': '#0068c8',
            '--menu-bg-mid': '#2a8df5',
            '--menu-bg-bottom': '#6db6ff',
            '--menu-wave1': '#84d12c',
            '--menu-wave2': '#6bb51b',
            '--menu-wave3': '#48820c',
            '--menu-moon-bg': '#ffecba',
            '--menu-moon-glow': 'rgba(255, 236, 186, 0.6)',
            '--menu-moon-inset': 'rgba(255, 200, 0, 0.4)',
            '--menu-title-color': '#FFD700',
            '--menu-btn-color': '#FFFFFF',
            '--menu-btn-hover': '#FFD700',
            '--menu-show-stars': '0',
            '--menu-show-lightning': '0'
        }
    },
    'starry': {
        name: 'Starry Night',
        type: 'canvas-stars',
        vars: {
            '--bg-main': '#000000',
            '--bg-secondary': 'rgba(10, 10, 15, 0.5)',
            '--bg-tertiary': 'rgba(0, 0, 5, 0.6)',
            '--text-main': '#d0d0e0',
            '--text-heading': '#ffffff',
            '--text-muted': '#808090',
            '--accent-color': '#8a2be2',
            '--accent-hover': '#9b42f5',
            '--accent-active': '#b05cff',
            '--border-color': 'rgba(138, 43, 226, 0.2)',
            '--btn-text': '#ffffff',
            '--input-bg': 'rgba(10, 10, 25, 0.8)',
            '--input-text': '#ffffff',
            '--color-success': '#66bb6a',
            '--color-success-hover': '#81c784',
            '--color-danger': '#ef5350',
            '--color-danger-hover': '#e57373',
            '--color-warning': '#ffa726',
            '--color-warning-hover': '#ffb74d',
            '--color-ai': '#7c4dff',
            '--color-ai-hover': '#b388ff',
            '--color-info': '#42a5f5',
            '--color-info-hover': '#64b5f6',
            '--color-secondary': '#5c5c6e',
            '--color-secondary-hover': '#7a7a8e',
            '--shadow-sm': '0 2px 8px rgba(0,0,0,0.2)',
            '--shadow-md': '0 4px 16px rgba(0,0,0,0.3)',
            '--shadow-lg': '0 8px 32px rgba(0,0,0,0.45)',
            '--shadow-xl': '0 12px 48px rgba(0,0,0,0.65)',
            '--menu-bg-top': '#080112',
            '--menu-bg-mid': '#16072b',
            '--menu-bg-bottom': '#2f1359',
            '--menu-wave1': '#1a0836',
            '--menu-wave2': '#260c4f',
            '--menu-wave3': '#381473',
            '--menu-moon-bg': '#e1ccff',
            '--menu-moon-glow': 'rgba(186, 133, 255, 0.5)',
            '--menu-moon-inset': 'rgba(70, 0, 150, 0.3)',
            '--menu-title-color': '#f0e6ff',
            '--menu-btn-color': '#d8c4ff',
            '--menu-btn-hover': '#ffffff',
            '--menu-show-stars': '1',
            '--menu-show-lightning': '0'
        }
    },
    'matrix': {
        name: 'Matrix',
        type: 'canvas-matrix',
        vars: {
            '--bg-main': '#000000',
            '--bg-secondary': 'rgba(0, 20, 0, 0.7)',
            '--bg-tertiary': 'rgba(0, 10, 0, 0.9)',
            '--text-main': '#00ff00',
            '--text-heading': '#88ff88',
            '--text-muted': '#008800',
            '--accent-color': '#00ff00',
            '--accent-hover': '#55ff55',
            '--accent-active': '#aaffaa',
            '--border-color': 'rgba(0, 255, 0, 0.3)',
            '--btn-text': '#000000',
            '--input-bg': 'rgba(0, 20, 0, 0.8)',
            '--input-text': '#00ff00',
            '--color-success': '#00cc00',
            '--color-success-hover': '#00ee00',
            '--color-danger': '#ff3333',
            '--color-danger-hover': '#ff5555',
            '--color-warning': '#cccc00',
            '--color-warning-hover': '#eeee00',
            '--color-ai': '#00ff88',
            '--color-ai-hover': '#00ffaa',
            '--color-info': '#00ccff',
            '--color-info-hover': '#00eeff',
            '--color-secondary': '#006600',
            '--color-secondary-hover': '#008800',
            '--shadow-sm': '0 2px 8px rgba(0,0,0,0.2)',
            '--shadow-md': '0 4px 16px rgba(0,0,0,0.3)',
            '--shadow-lg': '0 8px 32px rgba(0,0,0,0.45)',
            '--shadow-xl': '0 12px 48px rgba(0,0,0,0.65)',
            '--menu-bg-top': '#000000',
            '--menu-bg-mid': '#001100',
            '--menu-bg-bottom': '#002200',
            '--menu-wave1': '#000800',
            '--menu-wave2': '#001600',
            '--menu-wave3': '#002b00',
            '--menu-moon-bg': '#88ff88',
            '--menu-moon-glow': 'rgba(0, 255, 0, 0.4)',
            '--menu-moon-inset': 'rgba(0, 100, 0, 0.5)',
            '--menu-title-color': '#00ff00',
            '--menu-btn-color': '#00aa00',
            '--menu-btn-hover': '#00ff00',
            '--menu-show-stars': '1',
            '--menu-show-lightning': '1'
        }
    }
};

let bgCanvasInterval = null;
let animFrameId = null;

function applyTheme(themeId) {
    const theme = presetThemes[themeId] || presetThemes['dark'];

    if (bgCanvasInterval) {
        clearInterval(bgCanvasInterval);
        bgCanvasInterval = null;
    }
    if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
    }
    const oldCanvas = document.getElementById('bg-canvas');
    if (oldCanvas) oldCanvas.remove();
    document.body.style.backgroundImage = 'none';

    for (const [key, value] of Object.entries(theme.vars)) {
        document.documentElement.style.setProperty(key, value);
    }

    if (theme.type === 'image') {
        document.body.style.backgroundImage = `url('${theme.bgImage}')`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundAttachment = 'fixed';
    } else if (theme.type === 'canvas-stars') {
        // Skip canvas animations if user prefers reduced motion
        const wantsReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches || localStorage.getItem('jsonAdventure_reduceMotion') === 'true';
        if (!wantsReducedMotion) {
            initStarryBackground();
        }
    } else if (theme.type === 'canvas-matrix') {
        const wantsReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches || localStorage.getItem('jsonAdventure_reduceMotion') === 'true';
        if (!wantsReducedMotion) {
            initMatrixBackground();
        }
    }

    localStorage.setItem('jsonAdventure_activeThemeId', themeId);
}

function initStarryBackground() {
    const canvas = document.createElement('canvas');
    canvas.id = 'bg-canvas';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.zIndex = '-1';
    canvas.style.pointerEvents = 'none';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let width, height;
    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    const stars = [];
    for (let i = 0; i < 200; i++) {
        stars.push({
            x: Math.random() * width,
            y: Math.random() * height,
            radius: Math.random() * 1.5,
            alpha: Math.random(),
            speedAlpha: (Math.random() * 0.02) + 0.005,
        });
    }

    const shootingStars = [];

    function animate() {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);

        // draw static/twinkling stars
        stars.forEach(star => {
            star.alpha += star.speedAlpha;
            if (star.alpha <= 0 || star.alpha >= 1) {
                star.speedAlpha = -star.speedAlpha;
            }
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.abs(star.alpha)})`;
            ctx.fill();
        });

        // shooting stars randomly spawn
        if (Math.random() < 0.02) {
            shootingStars.push({
                x: Math.random() * width,
                y: 0,
                length: Math.random() * 80 + 20,
                speedX: (Math.random() * 10) + 5,
                speedY: (Math.random() * 10) + 5,
                opacity: 1
            });
        }

        for (let i = shootingStars.length - 1; i >= 0; i--) {
            const ss = shootingStars[i];
            ss.x += ss.speedX;
            ss.y += ss.speedY;
            ss.opacity -= 0.02;

            ctx.beginPath();
            ctx.moveTo(ss.x, ss.y);
            ctx.lineTo(ss.x - ss.length, ss.y - ss.length);
            ctx.strokeStyle = `rgba(255, 255, 255, ${ss.opacity})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            if (ss.opacity <= 0) shootingStars.splice(i, 1);
        }

        animFrameId = requestAnimationFrame(animate);
    }
    animate();
}

function initMatrixBackground() {
    const canvas = document.createElement('canvas');
    canvas.id = 'bg-canvas';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.zIndex = '-1';
    canvas.style.pointerEvents = 'none';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let width, height;
    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()';
    const fontSize = 16;
    let columns = width / fontSize;
    let drops = [];
    for (let x = 0; x < columns; x++) drops[x] = 1;

    function draw() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#0f0';
        ctx.font = fontSize + 'px monospace';

        if (drops.length < Math.floor(width / fontSize)) {
            const oldLen = drops.length;
            columns = Math.floor(width / fontSize);
            for (let i = oldLen; i < columns; i++) drops[i] = 1;
        }

        for (let i = 0; i < drops.length; i++) {
            const text = letters.charAt(Math.floor(Math.random() * letters.length));
            ctx.fillText(text, i * fontSize, drops[i] * fontSize);
            if (drops[i] * fontSize > height && Math.random() > 0.975) {
                drops[i] = 0;
            }
            drops[i]++;
        }
    }
    bgCanvasInterval = setInterval(draw, 33);
}

function loadGoogleFont(fontName, isPrimary = true) {
    if (!fontName) return;
    const fontId = 'google-font-' + fontName.replace(/\s+/g, '-').toLowerCase();
    if (!document.getElementById(fontId)) {
        const link = document.createElement('link');
        link.id = fontId;
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/\s+/g, '+')}:wght@300;400;500;600;700&display=swap`;
        document.head.appendChild(link);
    }
    if (isPrimary) document.documentElement.style.setProperty('--font-primary', `"${fontName}", serif`);
    else document.documentElement.style.setProperty('--font-secondary', `"${fontName}", sans-serif`);
}

function initializeTheme() {
    const activeTheme = localStorage.getItem('jsonAdventure_activeThemeId') || 'dark';
    applyTheme(activeTheme);

    const primaryFont = localStorage.getItem('jsonAdventure_primaryFont') || 'Cinzel';
    const secondaryFont = localStorage.getItem('jsonAdventure_secondaryFont') || 'Merriweather';

    loadGoogleFont(primaryFont, true);
    loadGoogleFont(secondaryFont, false);
    
    if (localStorage.getItem('jsonAdventure_reduceMotion') === 'true') {
        document.documentElement.setAttribute('data-reduce-motion', 'true');
    } else {
        document.documentElement.removeAttribute('data-reduce-motion');
    }
    
    if (localStorage.getItem('jsonAdventure_hideFocusRing') === 'true') {
        document.documentElement.setAttribute('data-hide-focus-ring', 'true');
    } else {
        document.documentElement.removeAttribute('data-hide-focus-ring');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
});
