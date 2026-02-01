const videoPlayer = document.getElementById('videoPlayer');
const channelURL = document.getElementById('channelURL');
const channelName = document.getElementById('channelName');
const playerHeader = document.getElementById('playerHeader');
let currentHls = null;
let renameTarget = null;


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

        for (const [name, url] of entries) {
            const channelItem = document.createElement('div');
            channelItem.className = 'channel';
            channelItem.innerHTML = `
                <div class="channel-content">
                    <span class="channel-name" title="${url}">${name}</span>
                    <div class="channel-buttons">
                        <button class="playChannel" title="Play">▶</button>
                        <button class="renameChannel" title="Edit" style="margin:0 5px">✎</button>
                        <button class="deleteChannel" title="Delete" style="background-color:var(--link)">✖</button>
                    </div>
                </div>
            `;

            channelItem.querySelector('.playChannel').addEventListener('click', () => playStream(url, name));
            channelItem.querySelector('.renameChannel').addEventListener('click', () => renameChannel(name));
            channelItem.querySelector('.deleteChannel').addEventListener('click', () => deleteChannel(name));

            channelList.appendChild(channelItem);
        }
    } catch (error) {
        console.log('Error loading channels from localStorage:', error);
        alert('Failed to load channels, please try again.');
    }
}


function renameChannel(oldName) {
    try {
        const savedChannels = JSON.parse(localStorage.getItem('channels')) || {};
        if (!savedChannels.hasOwnProperty(oldName)) return;

        channelName.value = oldName;
        channelURL.value = savedChannels[oldName];

        const inputContainer = document.getElementById('inputContainer');
        const isHidden = window.getComputedStyle(inputContainer).display === 'none';
        if (isHidden) toggleContent('inputContainer');

        renameTarget = oldName;
    } catch (error) {
        console.log('Error renaming channel:', error);
        alert('Could not rename channel. Please try again.');
    }
}


function deleteChannel(channelName) {
    try {
        const savedChannels = JSON.parse(localStorage.getItem('channels')) || {};
        delete savedChannels[channelName];
        localStorage.setItem('channels', JSON.stringify(savedChannels));
        loadChannels(); // Reload the channels list
    } catch (error) {
        console.log('Error deleting channel:', error);
        alert('Could not delete channel. Please try again.');
    }
}


document.getElementById('saveButton').addEventListener('click', () => {
    try {
        const url = channelURL.value.trim();
        const name = channelName.value.trim();

        if (!url) {
            alert('Please enter a valid stream URL.');
            return;
        }

        if (!/^https?:\/\/\S+$/i.test(url)) {
            alert('Please enter a valid HTTP/HTTPS URL.');
            return;
        }

        if (!name) {
            alert('Please enter a channel name.');
            return;
        }

        if (name.length > 40) {
            alert('Channel name too long (max 40 chars).');
            return;
        }

        const savedChannels = JSON.parse(localStorage.getItem('channels')) || {};

        if (renameTarget) {
            const oldName = renameTarget;
            if (!savedChannels.hasOwnProperty(oldName)) {
                alert('Original channel not found. It may have been removed.');
                renameTarget = null;
                loadChannels();
                return;
            }

            if (name !== oldName && savedChannels.hasOwnProperty(name)) {
                alert('A channel with that name already exists.');
                return;
            }

            delete savedChannels[oldName];
            savedChannels[name] = url;
            renameTarget = null;
        } else {
            if (savedChannels.hasOwnProperty(name)) {
                if (!confirm('A channel with that name already exists. Overwrite?')) return;
            }
            savedChannels[name] = url;
        }

        localStorage.setItem('channels', JSON.stringify(savedChannels));
        loadChannels();
        channelURL.value = '';
        channelName.value = '';
        toggleContent('inputContainer');
    } catch (error) {
        console.log('Error saving channel:', error);
        alert('Could not save channel. Please try again.');
    }
});


function playStream(url, name) {
    try {
        playerHeader.textContent = `IPTV Player | Now Playing: ${name}`;

        if (currentHls) {
            try {
                currentHls.destroy();
            } catch (e) {}
            currentHls = null;
        }

        if (Hls && Hls.isSupported && Hls.isSupported()) {
            currentHls = new Hls();
            currentHls.loadSource(url);
            currentHls.attachMedia(videoPlayer);
            currentHls.on(Hls.Events.MANIFEST_PARSED, function() {
                videoPlayer.play().catch(() => {});
            });
            currentHls.on(Hls.Events.ERROR, function(event, data) {
                console.log('Hls error:', data);
                if (data && data.fatal) {
                    alert('Playback error occurred. Try a different URL.');
                }
            });
        } else if (videoPlayer.canPlayType && videoPlayer.canPlayType('application/vnd.apple.mpegURL')) {
            videoPlayer.src = url;
            videoPlayer.addEventListener('loadedmetadata', function handler() {
                videoPlayer.removeEventListener('loadedmetadata', handler);
                videoPlayer.play().catch(() => {});
            });
        } else {
            alert('HLS not supported on your browser.');
        }
    } catch (error) {
        console.log('Error playing stream:', error);
        alert('Could not play stream. Please check the URL and try again.');
    }
}


function toggleContent(elementID) {
    const element = document.getElementById(elementID);
    const currentDisplay = window.getComputedStyle(element).display;
    element.style.display = currentDisplay === "none" ? "" : "none";
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


function openImportExport() {
    try {
        // Build dialog UI elements
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.left = 0;
        overlay.style.top = 0;
        overlay.style.right = 0;
        overlay.style.bottom = 0;
        overlay.style.background = 'rgba(0,0,0,0.4)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.zIndex = 9999;

        const box = document.createElement('div');
        box.style.background = 'var(--bg2)';
        box.style.color = 'var(--text)';
        box.style.padding = '16px';
        box.style.borderRadius = '8px';
        box.style.maxWidth = '520px';
        box.style.width = '92%';
        box.style.boxSizing = 'border-box';
        box.style.fontFamily = 'inherit';

        box.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center">
                <strong>Import / Export Channels</strong>
                <button id="closeImportExport" style="background:transparent;border:none;font-size:18px;cursor:pointer">✖</button>
            </div>
            <div style="margin-bottom:8px; gap:8px">
                <label style="cursor:pointer">
                    <input id="importFile" type="file" accept="application/json" style="display:none" />
                    <button id="chooseImport">Import JSON</button>
                </label>
                <button id="exportChannels">Export JSON</button>
            </div>
            <div style="font-size:13px;color:inherit;opacity:0.9">
                Export creates a JSON file of saved channels. Import replaces current channels (you will be prompted to confirm).
            </div>
        `;

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        // Handlers
        document.getElementById('closeImportExport').addEventListener('click', () => overlay.remove());

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
                    overlay.remove();
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
    } catch (error) {
        console.log('openImportExport error', error);
        alert('Could not open import/export dialog.');
    }
}


document.getElementById('importExportBtn').addEventListener('click', openImportExport);

document.addEventListener('DOMContentLoaded', loadChannels);
