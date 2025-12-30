const SERVER_URL = 'http://localhost:8080';
let blobs = [];

document.addEventListener('DOMContentLoaded', () => {
    initDropzone();
    checkServerStatus();
    loadBlobs();
});

function initDropzone() {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');

    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.background = 'rgba(78, 204, 163, 0.2)';
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.style.background = '';
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.background = '';
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            uploadFile(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            uploadFile(e.target.files[0]);
        }
    });
}

async function checkServerStatus() {
    try {
        const response = await fetch(SERVER_URL);
        document.getElementById('server-status').textContent = 'Running';
        document.getElementById('server-status').style.color = '#4ecca3';
    } catch (error) {
        document.getElementById('server-status').textContent = 'Offline';
        document.getElementById('server-status').style.color = '#e74c3c';
    }
}

async function uploadFile(file) {
    const progressBar = document.getElementById('progress-bar');
    const progressContainer = document.getElementById('upload-progress');

    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';

    try {
        const reader = new FileReader();

        reader.onload = async () => {
            const data = new Uint8Array(reader.result);
            const sha256 = await computeSHA256(data);

            progressBar.style.width = '30%';

            const response = await fetch(`${SERVER_URL}/upload`, {
                method: 'PUT',
                headers: {
                    'Content-Type': file.type || 'application/octet-stream',
                    'Content-Length': file.size,
                },
                body: data
            });

            progressBar.style.width = '100%';

            if (response.ok) {
                const descriptor = await response.json();
                blobs.unshift({
                    ...descriptor,
                    filename: file.name
                });
                renderBlobs();
            } else {
                alert('Upload failed: ' + response.statusText);
            }

            setTimeout(() => {
                progressContainer.style.display = 'none';
            }, 1000);
        };

        reader.onerror = () => {
            alert('Error reading file');
            progressContainer.style.display = 'none';
        };

        reader.readAsArrayBuffer(file);
    } catch (error) {
        alert('Upload error: ' + error.message);
        progressContainer.style.display = 'none';
    }
}

async function computeSHA256(data) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

function renderBlobs() {
    const blobList = document.getElementById('blob-list');

    if (blobs.length === 0) {
        blobList.innerHTML = '<li style="color: #aaa; text-align: center; padding: 20px;">No blobs uploaded yet</li>';
        return;
    }

    blobList.innerHTML = blobs.map(blob => `
        <li class="blob-item">
            <div class="blob-info">
                <h3>${blob.filename || blob.sha256}</h3>
                <p>${blob.mime_type} • ${formatSize(blob.size)}</p>
                <p><a href="${blob.url}" target="_blank" style="color: #4ecca3;">${blob.url}</a></p>
            </div>
            <div class="blob-actions">
                <button class="btn" onclick="copyUrl('${blob.url}')">Copy URL</button>
                <button class="btn" style="background: #e74c3c;" onclick="deleteBlob('${blob.sha256}')">Delete</button>
            </div>
        </li>
    `).join('');
}

function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function copyUrl(url) {
    navigator.clipboard.writeText(url);
    alert('URL copied to clipboard');
}

async function deleteBlob(sha256) {
    if (!confirm('Are you sure you want to delete this blob?')) return;

    try {
        const response = await fetch(`${SERVER_URL}/${sha256}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            blobs = blobs.filter(b => b.sha256 !== sha256);
            renderBlobs();
        } else {
            alert('Delete failed: ' + response.statusText);
        }
    } catch (error) {
        alert('Delete error: ' + error.message);
    }
}

function loadBlobs() {
    // Load blobs from local storage or API
    const saved = localStorage.getItem('blossom-blobs');
    if (saved) {
        blobs = JSON.parse(saved);
        renderBlobs();
    }
}

function saveBlobs() {
    localStorage.setItem('blossom-blobs', JSON.stringify(blobs));
}

// Save blobs on changes
const originalRenderBlobs = renderBlobs;
renderBlobs = function() {
    originalRenderBlobs();
    saveBlobs();
};
