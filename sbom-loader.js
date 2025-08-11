// SBOM Loader Script
let sbomData = null;
let currentFilePage = 1;
let currentRelationshipPage = 1;
const itemsPerPage = 100;
let filteredFiles = [];
let filteredRelationships = [];

// Load SBOM JSON file
async function loadSBOMFile() {
    try {
        console.log('Loading SBOM file...');
        console.log('Current location:', window.location.href);
        
        // Determine the base path for GitHub Pages
        let basePath = '';
        if (window.location.hostname.includes('github.io')) {
            // We're on GitHub Pages
            const pathParts = window.location.pathname.split('/').filter(p => p);
            if (pathParts.length > 0 && !pathParts[pathParts.length - 1].includes('.html')) {
                // We're in a project subdirectory (e.g., username.github.io/repo/)
                basePath = '/' + pathParts[0];
            }
        }
        
        // Try different paths for GitHub Pages compatibility
        const possiblePaths = [
            'sbom.spdx.json',
            './sbom.spdx.json',
            basePath + '/sbom.spdx.json',
            window.location.href.replace(/\/[^\/]*$/, '') + '/sbom.spdx.json'
        ];
        
        // Remove duplicates
        const uniquePaths = [...new Set(possiblePaths)];
        
        let response = null;
        let successPath = null;
        
        for (const path of uniquePaths) {
            try {
                console.log('Trying path:', path);
                response = await fetch(path);
                if (response.ok) {
                    successPath = path;
                    break;
                }
                console.log(`Response status for ${path}:`, response.status);
            } catch (e) {
                console.log(`Failed to fetch from ${path}:`, e.message);
            }
        }
        
        if (!response || !response.ok) {
            throw new Error('Could not find sbom.spdx.json. Please upload the file manually using the form below.');
        }
        
        console.log('Successfully loaded from:', successPath);
        const text = await response.text();
        
        // Parse JSON
        try {
            sbomData = JSON.parse(text);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            throw new Error('Invalid JSON format in sbom.spdx.json file');
        }
        
        console.log('SBOM parsed successfully:', {
            files: sbomData.files?.length || 0,
            packages: sbomData.packages?.length || 0,
            relationships: sbomData.relationships?.length || 0
        });
        
        // Initialize the UI with loaded data
        initializeUI();
        
        // Show success notification
        showNotification('SBOM file loaded successfully!', 'success');
        
        // Hide the upload section if it was shown
        document.getElementById('file-upload-section').style.display = 'none';
        
    } catch (error) {
        console.error('Error loading SBOM file:', error);
        
        // Show more helpful error message
        showNotification(error.message, 'error');
        
        // Show file upload section as fallback
        document.getElementById('file-upload-section').style.display = 'block';
    }
}

// Load SBOM from URL
async function loadSBOMFromURL(url) {
    try {
        console.log('Loading SBOM from URL:', url);
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        sbomData = await response.json();
        console.log('SBOM loaded from URL successfully:', {
            files: sbomData.files?.length || 0,
            packages: sbomData.packages?.length || 0,
            relationships: sbomData.relationships?.length || 0
        });
        
        // Initialize the UI with loaded data
        initializeUI();
        
        // Show success notification
        showNotification('SBOM file loaded from URL successfully!', 'success');
        
    } catch (error) {
        console.error('Error loading SBOM from URL:', error);
        showNotification(`Error loading from URL: ${error.message}`, 'error');
        
        // Try default loading as fallback
        loadSBOMFile();
    }
}

// Initialize UI with SBOM data
function initializeUI() {
    if (!sbomData) return;
    
    // Update statistics
    updateStatistics();
    
    // Update metadata
    updateMetadata();
    
    // Generate summaries
    generateLicenseSummary();
    generateFileTypeSummary();
    
    // Initialize filtered arrays
    filteredFiles = sbomData.files || [];
    filteredRelationships = sbomData.relationships || [];
    
    // Display initial data
    displayFiles();
    displayPackages();
    displayRelationships();
}

// Update statistics cards
function updateStatistics() {
    document.getElementById('total-files').textContent = sbomData.files?.length || 0;
    document.getElementById('total-packages').textContent = sbomData.packages?.length || 0;
    document.getElementById('total-relationships').textContent = sbomData.relationships?.length || 0;
    document.getElementById('spdx-version').textContent = sbomData.spdxVersion || '-';
}

// Update metadata information
function updateMetadata() {
    // Document info
    document.getElementById('doc-name').textContent = sbomData.name || '-';
    document.getElementById('doc-namespace').textContent = sbomData.documentNamespace || '-';
    document.getElementById('doc-spdxid').textContent = sbomData.SPDXID || '-';
    document.getElementById('doc-license').textContent = sbomData.dataLicense || '-';
    
    // Creation info
    if (sbomData.creationInfo) {
        document.getElementById('creation-date').textContent = 
            formatDate(sbomData.creationInfo.created) || '-';
        document.getElementById('creator').textContent = 
            sbomData.creationInfo.creators?.join(', ') || '-';
        document.getElementById('license-version').textContent = 
            sbomData.creationInfo.licenseListVersion || '-';
    }
}

// Generate license summary
function generateLicenseSummary() {
    if (!sbomData?.files) return;
    
    const licenseCounts = {};
    sbomData.files.forEach(file => {
        const license = file.licenseConcluded || 'Unknown';
        licenseCounts[license] = (licenseCounts[license] || 0) + 1;
    });
    
    const summaryHtml = Object.entries(licenseCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([license, count]) => `
            <div class="summary-item">
                <h4>License</h4>
                <p>${license}</p>
                <h4 style="margin-top: 10px;">Files</h4>
                <p>${count.toLocaleString()}</p>
            </div>
        `).join('');
    
    document.getElementById('license-summary').innerHTML = summaryHtml;
    
    // Populate license filter
    const licenseFilter = document.getElementById('license-filter');
    if (licenseFilter) {
        licenseFilter.innerHTML = '<option value="">All Licenses</option>' +
            Object.keys(licenseCounts).map(license => 
                `<option value="${license}">${license}</option>`
            ).join('');
    }
}

// Generate file type summary
function generateFileTypeSummary() {
    if (!sbomData?.files) return;
    
    const typeCounts = {};
    sbomData.files.forEach(file => {
        if (file.fileTypes) {
            file.fileTypes.forEach(type => {
                typeCounts[type] = (typeCounts[type] || 0) + 1;
            });
        }
    });
    
    const summaryHtml = Object.entries(typeCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => `
            <div class="summary-item">
                <h4>File Type</h4>
                <p>${type}</p>
                <h4 style="margin-top: 10px;">Count</h4>
                <p>${count.toLocaleString()}</p>
            </div>
        `).join('');
    
    document.getElementById('filetype-summary').innerHTML = summaryHtml;
    
    // Populate type filter
    const typeFilter = document.getElementById('type-filter');
    if (typeFilter) {
        typeFilter.innerHTML = '<option value="">All File Types</option>' +
            Object.keys(typeCounts).map(type => 
                `<option value="${type}">${type}</option>`
            ).join('');
    }
}

// Display files with pagination
function displayFiles() {
    const container = document.getElementById('files-container');
    if (!container) return;
    
    if (!sbomData?.files) {
        container.innerHTML = '<p>No files found in SBOM.</p>';
        return;
    }
    
    // Apply filters
    const searchTerm = document.getElementById('file-search')?.value.toLowerCase() || '';
    const licenseFilter = document.getElementById('license-filter')?.value || '';
    const typeFilter = document.getElementById('type-filter')?.value || '';
    
    filteredFiles = sbomData.files.filter(file => {
        const matchesSearch = !searchTerm || 
            file.fileName.toLowerCase().includes(searchTerm);
        const matchesLicense = !licenseFilter || 
            file.licenseConcluded === licenseFilter;
        const matchesType = !typeFilter || 
            (file.fileTypes && file.fileTypes.includes(typeFilter));
        
        return matchesSearch && matchesLicense && matchesType;
    });
    
    const totalPages = Math.ceil(filteredFiles.length / itemsPerPage);
    const startIndex = (currentFilePage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentFiles = filteredFiles.slice(startIndex, endIndex);
    
    let html = `
        <div class="results-info">
            Showing ${startIndex + 1}-${Math.min(endIndex, filteredFiles.length)} 
            of ${filteredFiles.length.toLocaleString()} files
            ${searchTerm || licenseFilter || typeFilter ? ' (filtered)' : ''}
        </div>
        <table class="file-table">
            <thead>
                <tr>
                    <th>File Path</th>
                    <th>License</th>
                    <th>Type</th>
                    <th>SHA256</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    currentFiles.forEach(file => {
        const sha256 = file.checksums?.find(c => c.algorithm === 'SHA256');
        
        html += `
            <tr>
                <td class="file-path" title="${escapeHtml(file.fileName)}">
                    ${escapeHtml(file.fileName)}
                </td>
                <td>
                    <span class="license-badge">
                        ${escapeHtml(file.licenseConcluded || 'Unknown')}
                    </span>
                </td>
                <td>${file.fileTypes ? file.fileTypes.map(escapeHtml).join(', ') : '-'}</td>
                <td class="checksum" title="${sha256?.checksumValue || ''}">
                    ${sha256 ? sha256.checksumValue.substring(0, 16) + '...' : '-'}
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
    
    // Update pagination
    updatePagination('files-pagination', currentFilePage, totalPages, (page) => {
        currentFilePage = page;
        displayFiles();
    });
}

// Display packages
function displayPackages() {
    const container = document.getElementById('packages-container');
    if (!container) return;
    
    if (!sbomData?.packages) {
        container.innerHTML = '<p>No packages found in SBOM.</p>';
        return;
    }
    
    let html = '<div class="metadata-grid">';
    
    sbomData.packages.forEach(pkg => {
        const fileCount = pkg.hasFiles?.length || 0;
        
        html += `
            <div class="metadata-card">
                <h3>${escapeHtml(pkg.name || 'Unknown Package')}</h3>
                <p><span class="label">SPDX ID:</span> ${escapeHtml(pkg.SPDXID)}</p>
                <p><span class="label">Version:</span> ${escapeHtml(pkg.versionInfo || 'Not specified')}</p>
                <p><span class="label">License:</span> ${escapeHtml(pkg.licenseConcluded || 'Unknown')}</p>
                <p><span class="label">Download Location:</span> 
                    ${escapeHtml(pkg.downloadLocation || 'Not specified')}</p>
                <p><span class="label">Files Analyzed:</span> ${pkg.filesAnalyzed ? 'Yes' : 'No'}</p>
                <p><span class="label">File Count:</span> ${fileCount.toLocaleString()}</p>
                ${pkg.packageVerificationCode ? 
                    `<p><span class="label">Verification Code:</span> 
                        <span class="checksum">${pkg.packageVerificationCode.packageVerificationCodeValue}</span>
                    </p>` : ''}
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// Display relationships with pagination
function displayRelationships() {
    const container = document.getElementById('relationships-container');
    if (!container) return;
    
    if (!sbomData?.relationships) {
        container.innerHTML = '<p>No relationships found in SBOM.</p>';
        return;
    }
    
    const searchTerm = document.getElementById('relationship-search')?.value.toLowerCase() || '';
    
    filteredRelationships = sbomData.relationships.filter(rel => {
        return !searchTerm || 
            rel.spdxElementId.toLowerCase().includes(searchTerm) ||
            rel.relatedSpdxElement.toLowerCase().includes(searchTerm) ||
            rel.relationshipType.toLowerCase().includes(searchTerm);
    });
    
    const totalPages = Math.ceil(filteredRelationships.length / itemsPerPage);
    const startIndex = (currentRelationshipPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentRelationships = filteredRelationships.slice(startIndex, endIndex);
    
    let html = `
        <div class="results-info">
            Showing ${startIndex + 1}-${Math.min(endIndex, filteredRelationships.length)} 
            of ${filteredRelationships.length.toLocaleString()} relationships
            ${searchTerm ? ' (filtered)' : ''}
        </div>
        <table class="file-table">
            <thead>
                <tr>
                    <th>Source Element</th>
                    <th>Relationship Type</th>
                    <th>Target Element</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    currentRelationships.forEach(rel => {
        html += `
            <tr>
                <td class="file-path">${escapeHtml(rel.spdxElementId)}</td>
                <td><strong>${escapeHtml(rel.relationshipType)}</strong></td>
                <td class="file-path">${escapeHtml(rel.relatedSpdxElement)}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
    
    // Update pagination
    updatePagination('relationships-pagination', currentRelationshipPage, totalPages, (page) => {
        currentRelationshipPage = page;
        displayRelationships();
    });
}

// Update pagination controls
function updatePagination(containerId, currentPage, totalPages, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '<div class="pagination">';
    
    // Previous button
    html += `<button ${currentPage === 1 ? 'disabled' : ''} 
        onclick="(${onPageChange})(${currentPage - 1})">← Previous</button>`;
    
    // Page numbers
    const maxButtons = 7;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    
    if (endPage - startPage < maxButtons - 1) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }
    
    if (startPage > 1) {
        html += `<button onclick="(${onPageChange})(1)">1</button>`;
        if (startPage > 2) html += '<span>...</span>';
    }
    
    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="${i === currentPage ? 'active' : ''}" 
            onclick="(${onPageChange})(${i})">${i}</button>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += '<span>...</span>';
        html += `<button onclick="(${onPageChange})(${totalPages})">${totalPages}</button>`;
    }
    
    // Next button
    html += `<button ${currentPage === totalPages ? 'disabled' : ''} 
        onclick="(${onPageChange})(${currentPage + 1})">Next →</button>`;
    
    html += '</div>';
    
    html += `<div class="page-info">Page ${currentPage} of ${totalPages}</div>`;
    
    container.innerHTML = html;
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Format date
function formatDate(dateString) {
    if (!dateString) return null;
    try {
        const date = new Date(dateString);
        return date.toLocaleString();
    } catch (e) {
        return dateString;
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Handle file upload
function handleFileUpload(file) {
    const reader = new FileReader();
    
    reader.onload = (e) => {
        try {
            sbomData = JSON.parse(e.target.result);
            initializeUI();
            showNotification('SBOM file uploaded successfully!', 'success');
            
            // Hide upload section
            document.getElementById('file-upload-section').style.display = 'none';
            
        } catch (error) {
            showNotification(`Error parsing file: ${error.message}`, 'error');
        }
    };
    
    reader.onerror = () => {
        showNotification('Error reading file', 'error');
    };
    
    reader.readAsText(file);
}

// Export filtered data as JSON
function exportFilteredData() {
    const exportData = {
        ...sbomData,
        files: filteredFiles,
        relationships: filteredRelationships
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], 
        { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'filtered-sbom.json';
    a.click();
    URL.revokeObjectURL(url);
    
    showNotification('Filtered data exported successfully!', 'success');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Check if there's a URL parameter for the SBOM file
    const urlParams = new URLSearchParams(window.location.search);
    const sbomUrl = urlParams.get('sbom');
    
    if (sbomUrl) {
        // Load from URL parameter
        loadSBOMFromURL(sbomUrl);
    } else {
        // Try to load SBOM file automatically from default location
        loadSBOMFile();
    }
    
    // Set up event listeners for search and filters
    const fileSearch = document.getElementById('file-search');
    if (fileSearch) {
        fileSearch.addEventListener('input', () => {
            currentFilePage = 1;
            displayFiles();
        });
    }
    
    const relationshipSearch = document.getElementById('relationship-search');
    if (relationshipSearch) {
        relationshipSearch.addEventListener('input', () => {
            currentRelationshipPage = 1;
            displayRelationships();
        });
    }
    
    const licenseFilter = document.getElementById('license-filter');
    if (licenseFilter) {
        licenseFilter.addEventListener('change', () => {
            currentFilePage = 1;
            displayFiles();
        });
    }
    
    const typeFilter = document.getElementById('type-filter');
    if (typeFilter) {
        typeFilter.addEventListener('change', () => {
            currentFilePage = 1;
            displayFiles();
        });
    }
    
    // File upload handling
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                handleFileUpload(file);
            }
        });
    }
    
    // Drag and drop handling
    const dropZone = document.getElementById('drop-zone');
    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            
            const file = e.dataTransfer.files[0];
            if (file && (file.name.endsWith('.json') || file.name.includes('.spdx'))) {
                handleFileUpload(file);
            } else {
                showNotification('Please upload a valid SPDX JSON file', 'error');
            }
        });
    }
});

// Tab switching function (to be called from HTML)
window.showTab = function(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
    
    // Refresh data if needed
    if (sbomData) {
        if (tabName === 'files') {
            displayFiles();
        } else if (tabName === 'packages') {
            displayPackages();
        } else if (tabName === 'relationships') {
            displayRelationships();
        }
    }
};