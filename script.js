const videoPlayer = document.getElementById('videoPlayer');
const channelURL = document.getElementById('channelURL');
const channelName = document.getElementById('channelName');
const playerHeader = document.getElementById('playerHeader');
let currentHls = null;
let renameTarget = null;

const dataModal = document.getElementById('dataModal');


function loadChannels() {
    try {
        const savedChannels = JSON.parse(localStorage.getItem('channels')) || {};
        const channelList = document.getElementById('savedChannels');
        channelList.innerHTML = ''; // Clear previous list

        const entries = Object.entries(savedChannels);
        if (entries.length === 0) {
            const empty = document.createElement('div');
            empty.innerHTML = `
                <div class="channel-content">
                    <span class="channel-name">No channels saved. Select the plus icon in the top-right to add a channel.</span>
                </div>
            `;
            channelList.appendChild(empty);
        }

        entries.sort((a, b) => a[0].toLowerCase().localeCompare(b[0].toLowerCase()));

        entries.forEach(([name, url], index) => {
            const channelItem = document.createElement('div');
            channelItem.className = 'channel';

            channelItem.innerHTML = `
                <div class="channel-content">
                    <span class="channel-name" title="${url}">${name}</span>
                    <button class="playChannel" title="Play">▶</button>
                    <button class="renameChannel" title="Edit">✎</button>
                </div>
            `;

            channelItem.querySelector('.playChannel').addEventListener('click', () => playStream(url, name));
            channelItem.querySelector('.renameChannel').addEventListener('click', () => openModal('edit', name));

            channelList.appendChild(channelItem);
        });
    } catch (error) {
        console.log('Error loading channels from localStorage:', error);
        alert('Failed to load channels, please try again.');
    }
}

function openModal(mode, name = '') {
    const channelModal = document.getElementById('channelModal');
    channelModal.className = mode === 'edit' ? 'edit-mode' : 'add-mode';
    
    if (mode === 'edit') {
        const savedChannels = JSON.parse(localStorage.getItem('channels')) || {};
        channelName.value = name;
        channelURL.value = savedChannels[name];
        renameTarget = name;
    } else {
        document.getElementById('channelForm').reset();
        renameTarget = null;
    }
    
    channelModal.showModal();
}

function deleteCurrentChannel() {
    if (!renameTarget || !confirm(`Delete "${renameTarget}"?`)) return;
    
    const savedChannels = JSON.parse(localStorage.getItem('channels')) || {};
    delete savedChannels[renameTarget];
    localStorage.setItem('channels', JSON.stringify(savedChannels));
    
    loadChannels();
    document.getElementById('channelModal').close();
}

document.getElementById('channelForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = channelName.value.trim();
    const url = channelURL.value.trim();
    const saved = JSON.parse(localStorage.getItem('channels')) || {};

    // Simplified collision check: only confirm if it's a new name or a different entry
    if (saved[name] && name !== renameTarget) {
        if (!confirm('A channel with that name already exists. Overwrite?')) return;
    }

    if (renameTarget) delete saved[renameTarget]; // Remove old key if renaming
    saved[name] = url;
    
    localStorage.setItem('channels', JSON.stringify(saved));
    loadChannels();
    e.target.reset(); // Native way to clear all inputs at once
    channelModal.close();
});

function playStream(url, name) {
    playerHeader.textContent = `IPTV Player | Now Playing: ${name}`;

    if (currentHls) currentHls.destroy();

    if (Hls?.isSupported()) {
        currentHls = new Hls();
        currentHls.loadSource(url);
        currentHls.attachMedia(videoPlayer);

        currentHls.on(Hls.Events.MANIFEST_PARSED, () => videoPlayer.play().catch(() => {}));

        currentHls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
                console.log('Hls fatal error:', data.type, data.details);
                alert('Playback error occurred. Try a different URL.');
            }
        });
    } else if (videoPlayer.canPlayType('application/vnd.apple.mpegURL')) {
        videoPlayer.src = url;
    } else {
        alert('HLS not supported on your browser.');
    }
}

// Helper to download text as file
function downloadFile(filename, content) {
    const blob = new Blob([content], {
        type: 'application/json;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

document.getElementById('exportChannels').addEventListener('click', () => {
    try {
        const saved = localStorage.getItem('channels') || '{}';
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const yyyy = now.getFullYear();
        const mm = pad(now.getMonth() + 1);
        const dd = pad(now.getDate());
        const filename = `channels-export-${yyyy}-${mm}-${dd}.json`;
        downloadFile(filename, saved);
    } catch (e) {
        console.log('Export error', e);
        alert('Could not export channels.');
    }
});

const importFileInput = document.getElementById('importFile');
document.getElementById('chooseImport').addEventListener('click', () => importFileInput.click());

importFileInput.addEventListener('change', (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = function() {
        try {
            const parsed = JSON.parse(reader.result);
            // Basic shape check: object of string->string
            if (typeof parsed !== 'object' || parsed === null) throw new Error('Invalid format');
            const keysOk = Object.keys(parsed).every(k => typeof k === 'string' && typeof parsed[k] === 'string');
            if (!keysOk) throw new Error('Invalid entries');

            if (!confirm('Import will replace your current saved channels. Continue?')) return;

            localStorage.setItem('channels', JSON.stringify(parsed));
            dataModal.close();
            loadChannels();
            alert('Import successful.');
        } catch (err) {
            console.log('Import error', err);
            alert('Invalid import file. Make sure it is a channels JSON export.');
        }
    };
    reader.onerror = function() {
        alert('Failed to read file.');
    };
    reader.readAsText(f);
});

document.addEventListener('DOMContentLoaded', loadChannels);


const updateModal = document.getElementById('updateModal');

window.addEventListener('load', () => {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('./sw.js')
    .then((reg) => {

      console.log("Service Worker registered");

      // If there's already an update waiting
      if (reg.waiting) {
        updateModal.showModal();
      }

      // Detect new updates
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;

        newWorker.addEventListener('statechange', () => {
          if (
            newWorker.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            updateModal.showModal();
          }
        });
      });

    })
    .catch((err) => console.log("Service Worker failed", err));

  // Reload when new SW activates
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
});

function applyUpdate() {
  navigator.serviceWorker.getRegistration().then((reg) => {
    if (reg && reg.waiting) {
      reg.waiting.postMessage('SKIP_WAITING');
    }
  });
}