// ATE Monitor Interactive Map Application
const SUPABASE_TABLE = 'rfds';

function toSupabaseRfd(rfd, panelId) {
  // Ensure monitors array exists
  const monitorsArr = rfd.monitors && Array.isArray(rfd.monitors) ? rfd.monitors : [{
    name: rfd.monitorName,
    tcoStatus: rfd.tcoStatus,
    comments: rfd.comments,
    creationDate: rfd.creationDate,
    monitorType: rfd.monitorType,
    currentThreshold: rfd.currentThreshold
  }];

  return {
    id: rfd.id, // include UUID
    map_id: rfd.mapId,
    monitor_name: monitorsArr[0]?.name || rfd.monitorName,
    creation_date: monitorsArr[0]?.creationDate || rfd.creationDate,
    tco_status: monitorsArr[0]?.tcoStatus || rfd.tcoStatus,
    comments: monitorsArr[0]?.comments || rfd.comments,
    type: rfd.type,
    shape_color: rfd.shapeColor,
    text_color: rfd.textColor,
    position: rfd.position,
    monitor_type: monitorsArr[0]?.monitorType || rfd.monitorType,
    current_threshold: monitorsArr[0]?.currentThreshold || rfd.currentThreshold,
    created_by: rfd.createdBy,
    created_at: rfd.createdAt,
    updated_by: rfd.updatedBy,
    updated_at: rfd.updatedAt,
    panel_id: panelId,
    change_log: rfd.changeLog,
    monitors: monitorsArr
  };
}

function fromSupabaseRfd(rfd) {
  const monitorsArr = rfd.monitors && Array.isArray(rfd.monitors) ? rfd.monitors : [{
    name: rfd.monitor_name,
    tcoStatus: rfd.tco_status,
    comments: rfd.comments,
    creationDate: rfd.creation_date,
    monitorType: rfd.monitor_type,
    currentThreshold: rfd.current_threshold
  }];

  return {
    id: rfd.id, // include UUID
    mapId: rfd.map_id,
    monitorName: monitorsArr[0]?.name || rfd.monitor_name,
    creationDate: monitorsArr[0]?.creationDate || rfd.creation_date,
    tcoStatus: monitorsArr[0]?.tcoStatus || rfd.tco_status,
    comments: monitorsArr[0]?.comments || rfd.comments,
    type: rfd.type,
    shapeColor: rfd.shape_color,
    textColor: rfd.text_color,
    position: rfd.position,
    monitorType: monitorsArr[0]?.monitorType || rfd.monitor_type,
    currentThreshold: monitorsArr[0]?.currentThreshold || rfd.current_threshold,
    createdBy: rfd.created_by,
    createdAt: rfd.created_at,
    updatedBy: rfd.updated_by,
    updatedAt: rfd.updated_at,
    panelId: rfd.panel_id,
    changeLog: rfd.change_log,
    monitors: monitorsArr
  };
}

async function fetchRfds(panelId) {
  const { data, error } = await window.supabase
    .from(SUPABASE_TABLE)
    .select('*')
    .eq('panel_id', panelId);
  if (error) {
    console.error('Error fetching RFDs:', error);
    return [];
  }
  return data;
}

async function addRfdToSupabase(rfd) {
  // Remove id if undefined (for new inserts)
  if (rfd.id === undefined) {
    delete rfd.id;
  }
  const { data, error } = await window.supabase
    .from(SUPABASE_TABLE)
    .insert([rfd])
    .select();
  if (error || !data) {
    console.error('Error adding RFD:', error, rfd);
    return null;
  }
  return data[0];
}

async function updateRfdInSupabase(rfd) {
  console.log('Updating RFD with id:', rfd.id);
  const { data, error } = await window.supabase
    .from(SUPABASE_TABLE)
    .update({ ...rfd, updated_at: new Date().toISOString() })
    .eq('id', rfd.id)
    .select(); // Ensure updated row is returned
  if (error || !data) {
    console.error('Error updating RFD:', error, rfd);
    return null;
  }
  return data[0];
}

async function deleteRfdFromSupabase(id) {
  const { error } = await window.supabase
    .from(SUPABASE_TABLE)
    .delete()
    .eq('id', id);
  if (error) {
    console.error('Error deleting RFD:', error);
    return false;
  }
  return true;
}

class ATEMonitorMap {
    constructor() {
        // Panel management
        this.panels = {
            panel1: { rfds: new Map(), image: 'electrical-panel-real.jpg', name: 'Integration', runsFile: 'runs-integration.csv' },
            panel2: { rfds: new Map(), image: 'inverter-vision-station-1.jpg', name: 'Inverter Vision Station 1', runsFile: 'runs-inverters.csv' },
            panel3: { rfds: new Map(), image: 'inverter-vision-station-2.jpg', name: 'Inverter Vision Station 2', runsFile: 'runs-inverters.csv' },
            panel4: { rfds: new Map(), image: 'inverter-vision-station-3.jpg', name: 'Inverter Vision Station 3', runsFile: 'runs-inverters.csv' },
            panel5: { rfds: new Map(), image: 'inverter-vision-station-4.jpg', name: 'Inverter Vision Station 4', runsFile: 'runs-inverters.csv' }
        };
        this.currentPanel = 'panel1';
        
        // Current panel data (references the active panel)
        this.rfds = this.panels[this.currentPanel].rfds;
        
        this.isMapLocked = false;
        this.isAddingRfd = false;
        this.selectedRfd = null;
        this.currentZoom = 1;
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };
        this.panOffset = { x: 0, y: 0 };
        this.isDrawing = false;
        this.drawingStart = { x: 0, y: 0 };
        this.drawingElement = null;
        this.isResizing = false;
        this.resizeHandle = null;
        this.resizeTimeout = null;
        this.isShiftPressed = false;
        this.isMouseDown = false;
        this.mouseMoveThrottle = null;
        this.draggedElement = null;
        
        // Copy/paste functionality
        this.copiedRfd = null;
        this.copyBuffer = null;
        
        // Performance history per metric (AP_*)
        this.performanceHistory = {}; // {metric: [{time,value,runId,modelVersion}]}
        
        this.initializeElements();
        this.bindEvents();
        
        // Load panel configuration first
        this.loadPanelConfiguration();
        
        // Load initial panel image
        this.loadInitialPanelImage();
        
        this.loadData();
        this.renderRfds();
        
        // Initialize settings
        this.initializeSettings();
        
        // Load saved theme
        this.loadTheme();
        
        // Initialize copy/paste button states
        this.updateCopyPasteButtons();
        this.updateSearchPlaceholder();

        // Lock map by default on first load
        if (!this.isMapLocked) {
            this.toggleMapLock();
        }

        // Auto-load runs.csv once render is done
        setTimeout(() => this.autoLoadRunsCsv(), 0);

        // Multi-selection set
        this.multiSelectedIds = new Set();

        // Call updateSearchField on load
        setTimeout(() => this.updateSearchField(), 0);

        this.changeLogWindow = document.createElement('div');
        this.changeLogWindow.className = 'change-log-window';
        Object.assign(this.changeLogWindow.style,{position:'fixed',display:'none',zIndex:'10000',background:'#fff',border:'1px solid #ccc',padding:'8px',borderRadius:'4px',boxShadow:'0 2px 6px rgba(0,0,0,0.2)',maxWidth:'260px',fontSize:'12px'});
        document.body.appendChild(this.changeLogWindow);

        // ... add in constructor after changeLogWindow creation
        this.changeLogHideTimeout = null;
        this.changeLogWindow.addEventListener('mouseenter',()=>{ if(this.changeLogHideTimeout){clearTimeout(this.changeLogHideTimeout);} });
        this.changeLogWindow.addEventListener('mouseleave',()=>{ this.hideChangeLog(); });

        // Real-time sync
        window.supabase
          .channel('rfds')
          .on('postgres_changes', { event: '*', schema: 'public', table: SUPABASE_TABLE }, payload => {
            if (payload.new && payload.new.panel_id === this.currentPanel) {
              this.loadData();
            } else if (payload.old && payload.old.panel_id === this.currentPanel) {
              this.loadData();
            }
          })
          .subscribe();

        this.latestRunsCsvText = '';
        this.editingMonitorIndex = null;
    }

    initializeElements() {
        // Main elements
        this.mapContainer = document.querySelector('.map-container');
        this.imageContainer = document.getElementById('imageContainer');
        this.rfdContainer = document.getElementById('rfdContainer');
        this.panelImage = document.getElementById('electricalPanel');
        this.rfdDetails = document.getElementById('rfdDetails');
        
        // Buttons
        this.addRfdBtn = document.getElementById('addRfdBtn');
        this.copyRfdBtn = document.getElementById('copyRfdBtn');
        this.pasteRfdBtn = document.getElementById('pasteRfdBtn');
        this.lockMapBtn = document.getElementById('lockMapBtn');
        this.resetDataBtn = document.getElementById('resetDataBtn');
        this.exportDataBtn = document.getElementById('exportDataBtn');
        this.exportImageBtn = document.getElementById('exportImageBtn');
        this.importDataBtn = document.getElementById('importDataBtn');
        this.importCsvBtn = document.getElementById('importCsvBtn');
        this.updateRunsBtn = document.getElementById('updateRunsBtn');
        this.searchBtn = document.getElementById('searchBtn');
        this.searchInput = document.getElementById('searchInput');
        this.performanceLegend = document.getElementById('performanceLegend');
        this.performanceSummary = document.getElementById('performanceSummary');
        
        // Modals
        this.rfdModal = document.getElementById('rfdModal');
        this.searchModal = document.getElementById('searchModal');
        this.rfdForm = document.getElementById('rfdForm');
        
        // Form elements
        this.modalTitle = document.getElementById('modalTitle');
        this.mapIdInput = document.getElementById('mapId');
        this.monitorNameInput = document.getElementById('monitorName');
        this.creationDateInput = document.getElementById('creationDate');
        this.tcoStatusInput = document.getElementById('tcoStatus');
        this.commentsInput = document.getElementById('comments');
        this.rfdTypeInput = document.getElementById('rfdType');
        this.shapeColorInput = document.getElementById('shapeColor');
        this.textColorInput = document.getElementById('textColor');
        this.monitorTypeInput = document.getElementById('monitorType');
        this.currentThresholdInput = document.getElementById('currentThreshold');
        
        // Close buttons
        this.closeModalBtn = document.getElementById('closeModalBtn');
        this.closeSearchModalBtn = document.getElementById('closeSearchModalBtn');
        this.closeSidebarBtn = document.getElementById('closeSidebarBtn');
        this.cancelBtn = document.getElementById('cancelBtn');
        
        // Search results
        this.searchResults = document.getElementById('searchResults');
        
        // Search mode selector
        this.searchMode = document.getElementById('searchMode');
        
        // Zoom controls
        this.zoomInBtn = document.getElementById('zoomInBtn');
        this.zoomOutBtn = document.getElementById('zoomOutBtn');
        this.resetZoomBtn = document.getElementById('resetZoomBtn');

        this.searchFieldContainer = document.getElementById('searchFieldContainer');

        // Detect existing Map ID when user types
        this.mapIdInput.addEventListener('input',()=>{
            if(!this.isAddingRfd) return;
            const val=this.mapIdInput.value.trim();
            const exists=this.rfds.has(val);
            const titleEl=document.getElementById('modalTitle');
            if(exists){
                titleEl.textContent=`Add Monitor to ${val}`;
            }else{
                titleEl.textContent='Add New RFD';
            }
        });
    }

    bindEvents() {
        // Button events
        this.addRfdBtn.addEventListener('click', () => this.openAddRfdModal());
        this.copyRfdBtn.addEventListener('click', () => this.copySelectedRfd());
        this.pasteRfdBtn.addEventListener('click', () => this.pasteRfd());
        this.lockMapBtn.addEventListener('click', () => this.toggleMapLock());
        this.resetDataBtn.addEventListener('click', () => this.resetData());
        this.exportDataBtn.addEventListener('click', () => this.exportData());
        this.exportImageBtn.addEventListener('click', () => this.exportImage());
        this.importDataBtn.addEventListener('click', () => this.importData());
        if(this.importCsvBtn){
            this.importCsvBtn.addEventListener('click', () => this.importPerformanceCsv());
        }
        this.updateRunsBtn.addEventListener('click', () => this.importRunsCsv());
        this.searchBtn.addEventListener('click', () => this.performSearch());
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.performSearch();
        });
        
        // Search mode change event
        this.searchMode.addEventListener('change', () => this.updateSearchField());
        
        // Modal events
        this.closeModalBtn.addEventListener('click', () => this.closeModal());
        this.closeSearchModalBtn.addEventListener('click', () => this.closeSearchModal());
        this.closeSidebarBtn.addEventListener('click', () => this.closeSidebar());
        this.cancelBtn.addEventListener('click', () => this.closeModal());
        
        // Form events
        this.rfdForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
        
        // Map events
        this.mapContainer.addEventListener('click', (e) => this.handleMapClick(e));
        this.mapContainer.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.mapContainer.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.mapContainer.addEventListener('mouseup', () => this.handleMouseUp());
        this.mapContainer.addEventListener('wheel', (e) => this.handleWheel(e));
        
        // Zoom events
        this.zoomInBtn.addEventListener('click', () => this.zoomIn());
        this.zoomOutBtn.addEventListener('click', () => this.zoomOut());
        this.resetZoomBtn.addEventListener('click', () => this.resetZoom());
        
        // Keyboard events
        document.addEventListener('keydown', (e) => this.handleKeydown(e));
        document.addEventListener('keyup', (e) => this.handleKeyup(e));
        
        // Panel tab events
        document.querySelectorAll('.panel-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const panelId = e.currentTarget.getAttribute('data-panel');
                this.switchPanel(panelId);
            });
        });
        
        // Window events
        window.addEventListener('resize', () => this.handleResize());
        
        // Global mouse up listener to ensure panning stops
        document.addEventListener('mouseup', () => {
            if (this.isPanning) {
                this.isPanning = false;
                this.mapContainer.style.cursor = '';
                this.mapContainer.classList.remove('shift-pressed');
                this.mapContainer.classList.remove('panning');
            }
        });
        
        // Global mouse leave listener to stop panning if mouse leaves window
        document.addEventListener('mouseleave', () => {
            if (this.isPanning) {
                this.isPanning = false;
                this.mapContainer.style.cursor = '';
                this.mapContainer.classList.remove('shift-pressed');
                this.mapContainer.classList.remove('panning');
            }
        });
        
        // Prevent default drag behavior when panning
        document.addEventListener('dragstart', (e) => {
            if (this.isPanning) {
                e.preventDefault();
                return false;
            }
        });
        
        document.addEventListener('selectstart', (e) => {
            if (this.isPanning) {
                e.preventDefault();
                return false;
            }
        });
        
        // Image load event
        this.panelImage.addEventListener('load', () => {
            // Wait for image to be fully loaded and rendered
            setTimeout(() => {
                if (this.panelImage.naturalWidth > 0 && this.panelImage.naturalHeight > 0) {
                    this.updateRfdPositions();
                }
            }, 200);
        });
        
        // Also handle when image is already loaded
        if (this.panelImage.complete && this.panelImage.naturalWidth > 0) {
            setTimeout(() => this.updateRfdPositions(), 100);
        }
    }

    async loadData() {
        // Load RFDs for the current panel from Supabase
        const rfdsArr = await fetchRfds(this.currentPanel);
        this.rfds = new Map(rfdsArr.map(rfd => [fromSupabaseRfd(rfd).mapId, fromSupabaseRfd(rfd)]));
        // After loading RFDs, re-apply performance data if available
        if (this.latestRunsCsvText && this.latestRunsCsvText.trim().length > 0) {
            this.processRunsCsv(this.latestRunsCsvText);
        }
        this.renderRfds();
    }

    async switchPanel(panelId) {
        if (panelId === this.currentPanel) return;
        if (!this.panels[panelId]) {
            console.error(`Panel ${panelId} does not exist`);
            return;
        }
        this.currentPanel = panelId;
        // Load RFDs for the new panel
        await this.loadData();
        
        // Update tab UI
        document.querySelectorAll('.panel-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-panel="${panelId}"]`).classList.add('active');
        
        // Clear selection
        this.clearSelection();
        
        // Update panel image
        const panelImage = this.panels[panelId].image;
        console.log(`Switching to panel ${panelId}, image: ${panelImage}`);
        
        // Load image from program directory
        this.panelImage.src = panelImage;
        
        // Handle image load errors
        this.panelImage.onerror = () => {
            console.warn(`Image not found: ${panelImage}`);
            this.showMessage(`Image not found for ${this.panels[panelId].name}: ${panelImage}`, 'warning');
        };
        
        // Handle successful image load
        this.panelImage.onload = () => {
            console.log(`Image loaded successfully: ${panelImage}`);
            // Update RFD positions after image loads
            setTimeout(() => {
                this.updateRfdPositions();
            }, 100);
        };
        
        console.log(`Switched to ${panelId}`);

        // Load station-specific runs.csv
        this.autoLoadRunsCsv();
    }

    saveCurrentPanelData() {}

    saveData() {}

    resetData() {
        if (!confirm(`Are you sure you want to reset all data for ${this.panels[this.currentPanel].name}? A backup JSON will be downloaded automatically before clearing everything.`)) {
            return;
        }

        // 1. Export current data as automatic backup
        this.exportData();

        // 2. Delete all RFDs for this panel in Supabase with a single query
        window.supabase
            .from(SUPABASE_TABLE)
            .delete()
            .eq('panel_id', this.currentPanel)
            .then(({ error }) => {
                if (error) console.error('resetData delete error:', error);
                // 3. Clear local state and refresh UI
                this.rfds.clear();
                this.renderRfds();
                this.clearSelection();
                this.showMessage(`Data reset successfully for ${this.panels[this.currentPanel].name}!`, 'success');
            });
    }

    createBackup() {
        try {
            // Get current data in the same format as export
            const dataToExport = Array.from(this.rfds.values());
            const backupData = {
                version: '1.0',
                exportDate: new Date().toISOString(),
                backupType: 'pre-reset',
                totalRFDs: this.rfds.size,
                rfds: dataToExport
            };
            
            // Create backup filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                            new Date().toISOString().split('T')[1].split('.')[0].replace(/:/g, '-');
            const backupFilename = `ate-monitor-backup-${timestamp}.json`;
            
            // Convert to JSON and create download
            const dataStr = JSON.stringify(backupData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            // Create download link
            const link = document.createElement('a');
            link.href = url;
            link.download = backupFilename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            
            // Cleanup
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            console.log(`Backup created: ${backupFilename} with ${this.rfds.size} RFDs`);
            
        } catch (error) {
            console.error('Error creating backup:', error);
            this.showMessage('Warning: Could not create backup before reset.', 'warning');
        }
    }

    exportData() {
        try {
            const dataToExport = Array.from(this.rfds.values());
            const exportData = {
                version: '1.0',
                exportDate: new Date().toISOString(),
                panelId: this.currentPanel,
                panelName: this.panels[this.currentPanel].name,
                rfds: dataToExport
            };
            
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `ate-monitor-${this.currentPanel}-data-${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            
            this.showMessage(`Data exported successfully for ${this.panels[this.currentPanel].name}!`, 'success');
        } catch (error) {
            console.error('Error exporting data:', error);
            this.showMessage('Error exporting data', 'error');
        }
    }

    exportImage() {
        try {
            // Show loading message
            this.showMessage('Generating export PDF...', 'info');
            
            // Create PDF without using canvas (to avoid CORS issues)
            this.createPDFWithoutCanvas();
            
        } catch (error) {
            console.error('Error exporting PDF:', error);
            this.showMessage('Error exporting PDF: ' + error.message, 'error');
        }
    }

    createPDFWithoutCanvas() {
        try {
            // Check if jsPDF is available
            if (typeof window.jspdf === 'undefined') {
                this.showMessage('PDF library not loaded. Please refresh the page and try again.', 'error');
                return;
            }
            
            const { jsPDF } = window.jspdf;
            
            // Create PDF
            const pdf = new jsPDF('landscape', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            
            // Add the full-page electrical panel image
            this.addFullPageImageToPDF(pdf, pageWidth, pageHeight);
            
            // Add legend on a new page
            pdf.addPage();
            pdf.setFontSize(16);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(0, 0, 0);
            pdf.text('RFD Details Legend', 20, 20);
            
            // Add RFD details
            let yPosition = 40;
            const rfds = Array.from(this.rfds.values());
            
            rfds.forEach((rfd, index) => {
                if (yPosition > pageHeight - 40) {
                    pdf.addPage();
                    yPosition = 20;
                }
                
                // RFD ID and name
                pdf.setFontSize(14);
                pdf.setFont('helvetica', 'bold');
                pdf.text(`${rfd.mapId}: ${rfd.monitorName}`, 20, yPosition);
                
                // Status
                pdf.setFontSize(12);
                pdf.setFont('helvetica', 'normal');
                pdf.text(`Status: ${rfd.tcoStatus || 'Not set'}`, 20, yPosition + 8);
                
                // Comments
                if (rfd.comments) {
                    pdf.setFontSize(10);
                    pdf.text(`Comments: ${rfd.comments}`, 20, yPosition + 16);
                    yPosition += 25;
                } else {
                    yPosition += 20;
                }
                
                // Add separator
                if (index < rfds.length - 1) {
                    pdf.line(20, yPosition + 5, pageWidth - 20, yPosition + 5);
                    yPosition += 10;
                }
            });
            
            // Save the PDF
            pdf.save(`ate-monitor-map-${new Date().toISOString().split('T')[0]}.pdf`);
            
            this.showMessage('PDF exported successfully!', 'success');
            
        } catch (error) {
            console.error('Error creating PDF:', error);
            this.showMessage('Error creating PDF: ' + error.message, 'error');
        }
    }

    addFullPageImageToPDF(pdf, pageWidth, pageHeight) {
        try {
            const panelImg = this.panelImage;
            
            if (panelImg && panelImg.complete && panelImg.naturalWidth > 0) {
                try {
                    // Calculate dimensions to maintain original aspect ratio
                    const originalWidth = panelImg.naturalWidth;
                    const originalHeight = panelImg.naturalHeight;
                    const imgAspectRatio = originalWidth / originalHeight;
                    const pageAspectRatio = pageWidth / pageHeight;
                    
                    let imgWidth, imgHeight, imgX, imgY;
                    
                    if (imgAspectRatio > pageAspectRatio) {
                        // Image is wider, fit to page width
                        imgWidth = pageWidth;
                        imgHeight = pageWidth / imgAspectRatio;
                        imgX = 0;
                        imgY = (pageHeight - imgHeight) / 2;
                    } else {
                        // Image is taller, fit to page height
                        imgHeight = pageHeight;
                        imgWidth = pageHeight * imgAspectRatio;
                        imgX = (pageWidth - imgWidth) / 2;
                        imgY = 0;
                    }
                    
                    // Add the original image directly to PDF (better quality)
                    pdf.addImage(panelImg.src, 'JPEG', imgX, imgY, imgWidth, imgHeight);
                    
                    // Draw transparent RFDs on top of the image
                    this.drawTransparentRFDsOnPDF(pdf, pageWidth, pageHeight, imgX, imgY, imgWidth, imgHeight);
                    
                    return; // Success, exit early
                    
                } catch (imageError) {
                    console.error('Image error, falling back to placeholder:', imageError);
                    // Continue to fallback below
                }
            }
            
            // Fallback: draw a placeholder
            pdf.setDrawColor(200, 200, 200);
            pdf.setFillColor(248, 249, 250);
            pdf.rect(0, 0, pageWidth, pageHeight, 'F');
            pdf.rect(0, 0, pageWidth, pageHeight, 'D');
            
            // Draw RFD positions as colored rectangles
            this.drawTransparentRFDsOnPDF(pdf, pageWidth, pageHeight, 0, 0, pageWidth, pageHeight);
            
        } catch (error) {
            console.error('Error adding image to PDF:', error);
            // Fallback to placeholder
            this.addFullPageImageToPDF(pdf, pageWidth, pageHeight);
        }
    }

    drawTransparentRFDsOnPDF(pdf, pageWidth, pageHeight, offsetX, offsetY, imgWidth, imgHeight) {
        const rfds = Array.from(this.rfds.values());
        const panelImg = this.panelImage;
        
        // Debug: Log all the dimensions to understand the coordinate systems
        console.log('PDF Export Debug:', {
            pageWidth,
            pageHeight,
            offsetX,
            offsetY,
            imgWidth,
            imgHeight,
            rfdContainerRect: this.rfdContainer.getBoundingClientRect(),
            imageContainerRect: this.imageContainer.getBoundingClientRect(),
            panelImageRect: this.panelImage.getBoundingClientRect(),
            originalImageWidth: panelImg.naturalWidth,
            originalImageHeight: panelImg.naturalHeight,
            rfdContainerWidth: this.rfdContainer.getBoundingClientRect().width,
            rfdContainerHeight: this.rfdContainer.getBoundingClientRect().height
        });
        
        rfds.forEach((rfd, index) => {
            // Always use actual RFD element position for precise positioning
            const rfdElement = document.querySelector(`[data-rfd-id="${rfd.mapId}"]`);
            let x, y, width, height;
            
            console.log(`Looking for RFD element with ID: ${rfd.mapId}`, rfdElement);
            
            if (rfdElement) {
                // Use stored percentage positions for accurate PDF positioning
                const xPercent = rfd.position?.x || 0;
                const yPercent = rfd.position?.y || 0;
                const widthPercent = rfd.position?.width || 10;
                const heightPercent = rfd.position?.height || 10;
                
                // Convert percentage positions to PDF coordinates
                x = (xPercent / 100) * imgWidth + offsetX;
                y = (yPercent / 100) * imgHeight + offsetY;
                width = (widthPercent / 100) * imgWidth;
                height = (heightPercent / 100) * imgHeight;
                
                // Use actual element positions for accurate PDF positioning
                
                console.log(`RFD ${rfd.mapId} PDF positioning:`, {
                    xPercent,
                    yPercent,
                    widthPercent,
                    heightPercent,
                    x,
                    y,
                    width,
                    height
                });
            } else {
                // Fallback to stored percentages
                console.log(`RFD ${rfd.mapId} element not found, using fallback percentages`);
                const xPercent = rfd.position?.x || 0;
                const yPercent = rfd.position?.y || 0;
                const widthPercent = rfd.position?.width || 10;
                const heightPercent = rfd.position?.height || 10;
                
                x = (xPercent / 100) * imgWidth + offsetX;
                y = (yPercent / 100) * imgHeight + offsetY;
                width = (widthPercent / 100) * imgWidth;
                height = (heightPercent / 100) * imgHeight;
            }
            
            // Convert hex color to RGB
            const color = this.hexToRgb(rfd.shapeColor || '#3498db');
            
            // Set only the border color (no fill)
            pdf.setDrawColor(color.r, color.g, color.b);
            pdf.setLineWidth(0.5); // Make borders thinner and more subtle
            
            if (rfd.type === 'circular') {
                // Draw only circle outline (no fill)
                pdf.ellipse(x + width/2, y + height/2, width/2, height/2, 'D');
            } else {
                // Draw only rectangle outline (no fill)
                pdf.rect(x, y, width, height, 'D');
            }
            
            // Add RFD ID with original color
            pdf.setFontSize(10);
            pdf.setTextColor(color.r, color.g, color.b);
            pdf.setFont('helvetica', 'bold');
            pdf.text(rfd.mapId, x + width/2, y + height/2 + 3, { align: 'center' });
        });
    }

    drawRFDsOnPDF(pdf, pageWidth, pageHeight, offsetX, offsetY, imgWidth, imgHeight) {
        const rfds = Array.from(this.rfds.values());
        
        rfds.forEach((rfd, index) => {
            // Use the stored RFD positions from the position object
            const xPercent = rfd.position?.x || 0;
            const yPercent = rfd.position?.y || 0;
            const widthPercent = rfd.position?.width || 10;
            const heightPercent = rfd.position?.height || 10;
            
            // Convert percentage positions to PDF coordinates
            const x = (xPercent / 100) * imgWidth + offsetX;
            const y = (yPercent / 100) * imgHeight + offsetY;
            const width = (widthPercent / 100) * imgWidth;
            const height = (heightPercent / 100) * imgHeight;
            
            // Convert hex color to RGB
            const color = this.hexToRgb(rfd.shapeColor || '#3498db');
            pdf.setFillColor(color.r, color.g, color.b);
            pdf.setDrawColor(color.r, color.g, color.b);
            
            if (rfd.type === 'circular') {
                // Draw circle
                pdf.ellipse(x + width/2, y + height/2, width/2, height/2, 'F');
                pdf.ellipse(x + width/2, y + height/2, width/2, height/2, 'D');
            } else {
                // Draw rectangle
                pdf.rect(x, y, width, height, 'F');
                pdf.rect(x, y, width, height, 'D');
            }
            
            // Add RFD ID
            pdf.setFontSize(8);
            pdf.setTextColor(0, 0, 0);
            pdf.text(rfd.mapId, x + width/2, y + height/2 + 2, { align: 'center' });
        });
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 52, g: 152, b: 219 };
    }



    drawLegend(ctx, width, height, padding, yOffset) {
        const rfds = Array.from(this.rfds.values());
        const itemsPerRow = 3;
        const itemHeight = 40;
        const itemWidth = (width - (padding * 2)) / itemsPerRow;
        
        // Draw legend title
        ctx.fillStyle = '#2c3e50';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('RFD Details:', padding, yOffset + 25);
        
        // Draw RFD items
        rfds.forEach((rfd, index) => {
            const row = Math.floor(index / itemsPerRow);
            const col = index % itemsPerRow;
            const x = padding + (col * itemWidth);
            const y = yOffset + 50 + (row * itemHeight);
            
            // Draw color box
            ctx.fillStyle = rfd.shapeColor || '#3498db';
            ctx.fillRect(x, y, 20, 20);
            ctx.strokeStyle = '#2c3e50';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, 20, 20);
            
            // Draw text
            ctx.fillStyle = '#2c3e50';
            ctx.font = '12px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`${rfd.mapId}: ${rfd.monitorName}`, x + 25, y + 15);
            
            // Draw status
            ctx.fillStyle = this.getStatusColor(rfd.tcoStatus);
            ctx.font = '10px Arial';
            ctx.fillText(`Status: ${rfd.tcoStatus || 'Not set'}`, x + 25, y + 28);
        });
    }

    getStatusColor(status) {
        switch (status) {
            case 'Implemented': return '#27ae60';
            case 'Pending': return '#f39c12';
            case 'Not Requested': return '#e74c3c';
            default: return '#7f8c8d';
        }
    }



    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const importedData = JSON.parse(event.target.result);
                    
                    if (!importedData.rfds || !Array.isArray(importedData.rfds)) {
                        this.showMessage('Invalid file format. Please select a valid export file.', 'error');
                        return;
                    }
                    
                    // Check if this is panel-specific data
                    const panelId = importedData.panelId || this.currentPanel;
                    const panelName = importedData.panelName || this.panels[this.currentPanel].name;
                    
                    if (!confirm(`Import ${importedData.rfds.length} RFDs for ${panelName}? This will replace all current data for this panel.`)) {
                        return;
                    }
                    
                    // Merge import with existing Supabase data
                    (async () => {
                        try {
                            // Fetch existing RFDs for this panel
                            const existingRows = await fetchRfds(panelId);
                            const existingMap = new Map();
                            existingRows.forEach(r => { const mapped = fromSupabaseRfd(r); existingMap.set(mapped.mapId, mapped); });

                            let added = 0, updated = 0;
                            for (const raw of importedData.rfds) {
                                const incoming = { ...raw };
                                const existing = existingMap.get(incoming.mapId);
                                if (existing) {
                                    // Merge monitors arrays (avoid duplicates by name)
                                    const merged = [...existing.monitors];
                                    (incoming.monitors||[]).forEach(m=>{
                                        if(!merged.find(x=> x.name===m.name)) merged.push(m);
                                    });
                                    existing.monitors = merged;
                                    existing.updatedAt = new Date().toISOString();
                                    existing.updatedBy = window.currentUsername || 'import';
                                    const res = await updateRfdInSupabase(toSupabaseRfd(existing,panelId));
                                    if(res) updated++;
                                } else {
                                    incoming.createdAt = new Date().toISOString();
                                    incoming.createdBy = window.currentUsername || 'import';
                                    const res = await addRfdToSupabase(toSupabaseRfd(incoming,panelId));
                                    if(res) added++;
                                }
                            }

                            await this.loadData();
                            this.clearSelection();
                            this.showMessage(`Import complete! Added ${added}, updated ${updated} RFDs for ${panelName}.`, 'success');
                        } catch (err) {
                            console.error('Import error:', err);
                            this.showMessage('Import failed – see console.', 'error');
                        }
                    })();
                    
                    // Clear selection
                    this.clearSelection();
                    
                    this.showMessage(`Successfully imported ${importedData.rfds.length} RFDs for ${panelName}!`, 'success');
                } catch (error) {
                    console.error('Error importing data:', error);
                    this.showMessage('Error importing data. Please check the file format.', 'error');
                }
            };
            
            reader.readAsText(file);
        };
        
        input.click();
    }

    loadSampleData() {
        // Load sample RFD data based on the Excel sheet structure
        const sampleRfds = [
            {
                mapId: 'L1',
                monitorName: 'CE0682 module not responding-7-2,1-1-3-27',
                creationDate: '2025-01-15',
                tcoStatus: 'Pending',
                comments: 'Telit module needs replacement',
                type: 'rectangular',
                shapeColor: '#3498db',
                textColor: '#2c3e50',
                position: { x: 15, y: 10, width: 10, height: 6 }
            },
            {
                mapId: 'L2',
                monitorName: 'Solar edge branding chip damaged-7-2,3-1-6-25',
                creationDate: '2025-01-16',
                tcoStatus: 'Not Requested',
                comments: 'Chip with solar edge branding needs inspection',
                type: 'rectangular',
                shapeColor: '#e74c3c',
                textColor: '#ffffff',
                position: { x: 37, y: 15, width: 7.5, height: 5 }
            },
            {
                mapId: 'L3',
                monitorName: 'BM module stack alignment problem-7-8,1-1,6,10',
                creationDate: '2025-01-17',
                tcoStatus: 'Implemented',
                comments: 'Six BM modules need proper alignment',
                type: 'rectangular',
                shapeColor: '#27ae60',
                textColor: '#ffffff',
                position: { x: 6, y: 6, width: 5, height: 15 }
            },
            {
                mapId: 'L4',
                monitorName: 'Hyundai white component damaged-7-0,9-1-3-12',
                creationDate: '2025-01-18',
                tcoStatus: 'Pending',
                comments: 'Tall white Hyundai component needs replacement',
                type: 'rectangular',
                shapeColor: '#f39c12',
                textColor: '#2c3e50',
                position: { x: 25, y: 5, width: 4, height: 10 }
            },
            {
                mapId: 'L5',
                monitorName: 'Copper busbar loose connection-7-4,7-1-1-14',
                creationDate: '2025-01-19',
                tcoStatus: 'Not Requested',
                comments: 'Thick copper busbar needs secure connection',
                type: 'rectangular',
                shapeColor: '#8e44ad',
                textColor: '#ffffff',
                position: { x: 50, y: 25, width: 12.5, height: 2.5 }
            },
            {
                mapId: 'L6',
                monitorName: 'Inductor coil around ferrite core damaged-7-5,2-5-7-0',
                creationDate: '2025-01-20',
                tcoStatus: 'Pending',
                comments: 'Brown inductor coils need inspection',
                type: 'circular',
                shapeColor: '#d35400',
                textColor: '#ffffff',
                position: { x: 62, y: 31, width: 4.5, height: 4.5 }
            },
            {
                mapId: 'L7',
                monitorName: 'Missing HS Scr 7-7-6,3-1-1-27',
                creationDate: '2025-01-21',
                tcoStatus: 'Implemented',
                comments: 'Missing heatshrink screw 7 needs replacement',
                type: 'rectangular',
                shapeColor: '#16a085',
                textColor: '#ffffff',
                position: { x: 75, y: 44, width: 6, height: 4 }
            },
            {
                mapId: 'L8',
                monitorName: 'L1 L2 N terminal block connection issue-7-4,7-1-1-14',
                creationDate: '2025-01-22',
                tcoStatus: 'Not Requested',
                comments: 'Green terminal blocks L1, L2, N need inspection',
                type: 'rectangular',
                shapeColor: '#c0392b',
                textColor: '#ffffff',
                position: { x: 81, y: 40, width: 10, height: 5 }
            },
            {
                mapId: 'L9',
                monitorName: 'Black circular cable glands seal broken-7-5,2-5-7-0',
                creationDate: '2025-01-23',
                tcoStatus: 'Pending',
                comments: 'Cable glands at bottom edge need replacement',
                type: 'circular',
                shapeColor: '#34495e',
                textColor: '#ffffff',
                position: { x: 19, y: 56, width: 3, height: 3 }
            },
            {
                mapId: 'L10',
                monitorName: 'Yellow electrical tape bundle loose-7-6,3-1-1-27',
                creationDate: '2025-01-24',
                tcoStatus: 'Not Requested',
                comments: 'Yellow taped wire bundle needs securing',
                type: 'rectangular',
                shapeColor: '#f1c40f',
                textColor: '#2c3e50',
                position: { x: 44, y: 37, width: 7.5, height: 2 }
            }
        ];

        sampleRfds.forEach(rfd => {
            this.rfds.set(rfd.mapId, rfd);
        });
        
        // Save the sample data to localStorage
        this.saveData();
    }

    renderRfds() {
        this.rfdContainer.innerHTML = '';
        
        this.rfds.forEach((rfd, id) => {
            const rfdElement = this.createRfdElement(rfd);
            this.rfdContainer.appendChild(rfdElement);
        });
        
        // Update positions after rendering
        this.updateRfdPositions();
        
        // Update border thickness for all RFDs
        this.updateRfdBorderThickness();
        this.updatePerformanceColors();
    }

    createRfdElement(rfd) {
        const element = document.createElement('div');
        element.className = `rfd ${rfd.type}`;
        element.dataset.rfdId = rfd.mapId;
        element.textContent = rfd.mapId;
        
        // Set colors
        element.style.borderColor = rfd.shapeColor || '#3498db';
        element.style.backgroundColor = this.hexToRgba(rfd.shapeColor || '#3498db', 0.2);
        element.style.color = rfd.textColor || '#2c3e50';
        
        // Add hover effect
        element.addEventListener('mouseenter', () => {
            element.style.backgroundColor = this.hexToRgba(rfd.shapeColor || '#3498db', 0.4);
        });
        
        element.addEventListener('mouseleave', () => {
            element.style.backgroundColor = this.hexToRgba(rfd.shapeColor || '#3498db', 0.2);
        });
        
        // Add click event
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            // For locked map, selection is already handled in mousedown; skip
            if (this.isMapLocked) return;
            this.selectRfd(rfd.mapId, e.ctrlKey || e.metaKey);
        });
        
        // Add resize handles
        this.addResizeHandles(element);
        
        return element;
    }

    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    addResizeHandles(element) {
        const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
        handles.forEach(handle => {
            const handleElement = document.createElement('div');
            handleElement.className = `resize-handle ${handle}`;
            handleElement.dataset.handle = handle;
            element.appendChild(handleElement);
        });
        console.log('Added resize handles to element:', element);
    }

    selectRfd(rfdId, isMulti = false) {
        if (isMulti) {
            // Toggle selection
            if (this.multiSelectedIds.has(rfdId)) {
                this.multiSelectedIds.delete(rfdId);
                document.querySelector(`[data-rfd-id="${rfdId}"]`)?.classList.remove('selected');
            } else {
                this.multiSelectedIds.add(rfdId);
                document.querySelector(`[data-rfd-id="${rfdId}"]`)?.classList.add('selected');
                this.selectedRfd = this.rfds.get(rfdId); // keep last clicked primary
            }
        } else {
            // Single-select – clear previous selection first
            this.clearSelection();
            this.multiSelectedIds.clear();
            this.multiSelectedIds.add(rfdId);
            document.querySelector(`[data-rfd-id="${rfdId}"]`)?.classList.add('selected');
        this.selectedRfd = this.rfds.get(rfdId);
        }
        // Update details panel
        this.updateDetailsPanel();
        // Update resize handles etc.
        this.updateResizeHandleSizes();
        this.updateCopyPasteButtons();
        this.updatePerformanceColors();
    }

    updateDetailsPanel() {
        // 1. No selection – show placeholder
        if (this.multiSelectedIds.size === 0) {
            this.rfdDetails.innerHTML = '<p class="no-selection">Select an RFD to view details</p>';
            return;
        }

        // Helper to grab the first (and only) selected RFD id
        const firstSelectedId = Array.from(this.multiSelectedIds)[0];

        // 2. Exactly one RFD selected
        if (this.multiSelectedIds.size === 1) {
            const r = this.rfds.get(firstSelectedId);
            if (!r) {
                this.rfdDetails.innerHTML = '<p class="no-selection">Select an RFD to view details</p>';
                return;
            }

            // If this RFD has more than one monitor, render the monitor list so the user can drill-down
            if (r.monitors && Array.isArray(r.monitors) && r.monitors.length > 1) {
                let html = `<h4>${r.mapId} – ${r.monitors.length} monitors</h4><ul class="multi-list">`;
                r.monitors.forEach((m, i) => {
                    html += `<li style="cursor:pointer" onclick="app.showMonitorDetails('${r.mapId}',${i})"><strong>${m.name}</strong> – thr ${(m.currentThreshold || '0.7')} <span style="color:#e74c3c;float:right;cursor:pointer" onclick="event.stopPropagation();app.deleteMonitor('${r.mapId}',${i})">🗑</span></li>`;
                });
                html += '</ul>';
                html += `<div class="form-actions"><button class="btn-secondary" onclick="app.editRfd('${r.mapId}')"><i class="fas fa-vector-square"></i> Edit Box</button></div>`;
                this.rfdDetails.innerHTML = html;
            } else {
                // Plain single-monitor RFD → show its details directly
                this.displayRfdDetails(r);
            }
            return;
        }

        // 3. Multiple RFDs selected – build combined monitor list
        let monitorCount = 0;
        let html = '<ul class="multi-list">';
        this.multiSelectedIds.forEach(id => {
            const r = this.rfds.get(id);
            if (!r) return;

            if (r.monitors && Array.isArray(r.monitors) && r.monitors.length) {
                r.monitors.forEach((m, idx) => {
                    html += `<li data-map-id="${id}" data-monitor-idx="${idx}"><strong>${id}</strong> – ${m.name}</li>`;
                    monitorCount += 1;
                });
            } else {
                html += `<li data-map-id="${id}"><strong>${id}</strong> – ${r.monitorName || ''}</li>`;
                monitorCount += 1;
            }
        });
        html += '</ul>';
        html = `<h4>${monitorCount} Monitors selected</h4>` + html + `<div class="form-actions"><button class="btn-secondary" onclick="app.openMultiPerformancePage()"><i class="fas fa-chart-line"></i> Performance</button></div>`;
        this.rfdDetails.innerHTML = html;

        // Attach click listeners for the generated list
        this.rfdDetails.querySelectorAll('.multi-list li').forEach(li => {
            li.style.cursor = 'pointer';
            li.addEventListener('click', e => {
                e.stopPropagation();
                const mapId = li.getAttribute('data-map-id');
                const idxAttr = li.getAttribute('data-monitor-idx');
                if (idxAttr !== null) {
                    const idx = parseInt(idxAttr, 10);
                    this.showMonitorDetails(mapId, idx);
                } else {
                    const r = this.rfds.get(mapId);
                    if (r) this.displayRfdDetails(r);
                }
            });
        });

        // Refresh performance outlines after rebuilding the panel
        this.updatePerformanceColors();
    }

    displayRfdDetails(rfd) {
        if (!rfd) {
            this.rfdDetails.innerHTML = '<p class="no-selection">Select an RFD to view details</p>';
            return;
        }
        const statusClass=this.getStatusClass(rfd.tcoStatus);
        const infoIcon = field=>`<span class="change-log-icon" data-field="${field}" style="cursor:pointer;color:#3498db;margin-left:4px;">&#9432;</span>`;
        this.rfdDetails.innerHTML = `
            <div class="rfd-detail-item"><h4>Map ID ${infoIcon('mapId')}</h4><p>${rfd.mapId}</p></div>
            <div class="rfd-detail-item"><h4>Monitor Name ${infoIcon('monitorName')}</h4><p>${rfd.monitorName}</p></div>
            <div class="rfd-detail-item"><h4>TCO Status ${infoIcon('tcoStatus')}</h4><p class="${statusClass}">${rfd.tcoStatus||'Not set'}</p></div>
            <div class="rfd-detail-item"><h4>Creation Date ${infoIcon('creationDate')}</h4><p>${rfd.creationDate||'N/A'}</p></div>
            <div class="rfd-detail-item"><h4>Type ${infoIcon('type')}</h4><p>${rfd.type}</p></div>
            <div class="rfd-detail-item"><h4>Monitor Type ${infoIcon('monitorType')}</h4><p>${rfd.monitorType || 'Normal - Error validation'}</p></div>
            <div class="rfd-detail-item"><h4>Current Threshold ${infoIcon('currentThreshold')}</h4><p>${typeof rfd.currentThreshold==='number'? rfd.currentThreshold : '0.7'}</p></div>
            <div class="rfd-detail-item"><h4>Created By</h4><p>${rfd.createdBy || 'N/A'} @ ${(rfd.createdAt? new Date(rfd.createdAt).toLocaleString(): 'N/A')}</p></div>
            <div class="rfd-detail-item"><h4>Comments ${infoIcon('comments')}</h4><p>${rfd.comments || 'N/A'}</p></div>
            ${rfd.updatedBy ? `<div class="rfd-detail-item"><h4>Last Modified</h4><p>${rfd.updatedBy} @ ${new Date(rfd.updatedAt).toLocaleString()}</p></div>` : ''}
            <div class="form-actions"><button class="btn-secondary" onclick="app.editRfd('${rfd.mapId}')"><i class="fas fa-edit"></i> Edit</button>
            <button class="btn-secondary" onclick="app.deleteRfd('${rfd.mapId}')"><i class="fas fa-trash"></i> Delete</button>
            <button class="btn-secondary" onclick="app.openPerformancePage('${rfd.mapId}')"><i class="fas fa-chart-line"></i> Performance</button>
            <button class="btn-secondary" onclick="app.editRfd('${rfd.mapId}')"><i class="fas fa-vector-square"></i> Edit Box</button></div>`;
        // attach hover listeners
        this.rfdDetails.querySelectorAll('.change-log-icon').forEach(icon=>{
            icon.addEventListener('mouseenter',e=>{ const field=e.currentTarget.dataset.field; this.showChangeLog(rfd,field,e.clientX,e.clientY); });
            icon.addEventListener('mouseleave',()=>{ this.scheduleHideChangeLog(); });
        });
    }

    createMonitorLink(monitorName) {
        // Convert monitor name to a clickable link
        return `<a href="#" onclick="app.openMonitorLink('${monitorName}')">${monitorName}</a>`;
    }

    getStatusClass(status) {
        switch (status) {
            case 'Implemented': return 'status-implemented';
            case 'Pending': return 'status-pending';
            case 'Not Requested': return 'status-not-requested';
            default: return '';
        }
    }

    openMonitorLink(monitorName) {
        // This would typically open a detailed view or external system
        alert(`Opening monitor details for: ${monitorName}`);
        // In a real application, this might open a new window or navigate to a detailed view
    }

    openAddRfdModal() {
        this.isAddingRfd = true;
        this.modalTitle.textContent = 'Add New RFD';
        this.clearForm();
        this.showModal();
        
        // Start drawing mode after modal is shown
        setTimeout(() => {
            this.startDrawingMode();
        }, 100);
    }

    editRfd(rfdId) {
        const rfd = this.rfds.get(rfdId);
        if (!rfd) return;

        this.isAddingRfd = false;
        this.modalTitle.textContent = 'Edit RFD';
        this.populateForm(rfd);
        this.showModal();
        this.editingOriginalId = rfd.mapId;
    }

    populateForm(rfd) {
        this.mapIdInput.value = rfd.mapId;
        this.monitorNameInput.value = rfd.monitorName;
        this.creationDateInput.value = rfd.creationDate || '';
        this.tcoStatusInput.value = rfd.tcoStatus || '';
        this.commentsInput.value = rfd.comments || '';
        this.rfdTypeInput.value = rfd.type;
        this.shapeColorInput.value = rfd.shapeColor || '#3498db';
        this.textColorInput.value = rfd.textColor || '#2c3e50';
        if(this.monitorTypeInput){ this.monitorTypeInput.value = rfd.monitorType || 'Normal - Error validation'; }
        if(this.currentThresholdInput){ this.currentThresholdInput.value = rfd.currentThreshold ?? 0.7; }
    }

    clearForm() {
        this.rfdForm.reset();
        this.creationDateInput.value = new Date().toISOString().split('T')[0];
        this.shapeColorInput.value = '#3498db';
        this.textColorInput.value = '#2c3e50';
        
        // Remove any position input
        const positionInput = this.rfdForm.querySelector('input[name="position"]');
        if (positionInput) {
            positionInput.remove();
        }
    }

    async handleFormSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(this.rfdForm);
        
        // Get position from form or use default
        let position = { x: 10, y: 10, width: 8, height: 6 }; // Default position
        const positionInput = this.rfdForm.querySelector('input[name="position"]');
        if (positionInput && positionInput.value) {
            try {
                position = JSON.parse(positionInput.value);
            } catch (e) {
                console.warn('Invalid position data, using default');
            }
        }
        
        const rfdData = {
            mapId: formData.get('mapId'),
            monitorName: formData.get('monitorName'),
            creationDate: formData.get('creationDate'),
            tcoStatus: formData.get('tcoStatus'),
            comments: formData.get('comments'),
            type: formData.get('rfdType'),
            shapeColor: formData.get('shapeColor'),
            textColor: formData.get('textColor'),
            position: position,
            monitorType: formData.get('monitorType') || 'Normal - Error validation',
            currentThreshold: parseFloat(formData.get('currentThreshold')) || 0.7,
        };

        if(!this.isAddingRfd){
            rfdData.originalMapId = this.editingOriginalId;
        }

        // If adding and Map ID already exists, append as additional monitor
        if(this.isAddingRfd && this.rfds.has(rfdData.mapId)){
            const existing = this.rfds.get(rfdData.mapId);
            if(!existing.monitors) existing.monitors=[];
            existing.monitors.push({
                name: rfdData.monitorName,
                tcoStatus: rfdData.tcoStatus,
                comments: rfdData.comments,
                creationDate: rfdData.creationDate,
                monitorType: rfdData.monitorType,
                currentThreshold: rfdData.currentThreshold
            });
            // Update metadata
            existing.updatedAt = new Date().toISOString();
            let currentUser = 'Unknown';
            if(window.Auth && Auth.user && Auth.loggedIn){ currentUser = Auth.user.username; }
            else if(window.currentUsername){ currentUser = window.currentUsername; }
            existing.updatedBy = currentUser;

            const updated = await updateRfdInSupabase(toSupabaseRfd(existing,this.currentPanel));
            if(updated){
                this.rfds.set(existing.mapId, fromSupabaseRfd(updated));
                this.renderRfds();
                this.selectRfd(existing.mapId);
                this.closeModal();
                this.showMessage('New monitor added to existing Map ID!', 'success');
            }else{
                this.showMessage('Failed to add monitor – see console.', 'error');
            }
            this.closeModal();
            return;
        }

        if (this.isAddingRfd) {
            this.addRfd(rfdData);
        } else {
            this.updateRfd(rfdData);
            this.editingOriginalId = null;
        }
        
        this.closeModal();
    }

    async addRfd(rfdData) {
        if (this.rfds.has(rfdData.mapId)) {
            this.showMessage('Map ID already exists!', 'error');
            return;
        }

        // Attach user metadata
        let currentUser = 'Unknown';
        if(window.Auth && Auth.user && Auth.loggedIn){ currentUser = Auth.user.username; }
        else if(window.currentUsername){ currentUser = window.currentUsername; }
        else{
            const stored = localStorage.getItem('currentUsername');
            if(stored){ currentUser = stored; }
        }
        rfdData.createdBy = currentUser;
        rfdData.createdAt = new Date().toISOString();
        // Do NOT add to this.rfds or render until insert returns
        const newRfd = await addRfdToSupabase(toSupabaseRfd(rfdData, this.currentPanel));
        if (newRfd) {
            // Remove any temporary/undefined RFD
            this.rfds.delete(undefined);
            this.rfds.set(newRfd.map_id, fromSupabaseRfd(newRfd));
            this.renderRfds();
            this.selectRfd(newRfd.map_id); // Select the new RFD
            this.showMessage('RFD added successfully!', 'success');
            // Optionally, ensure full sync after a short delay
            setTimeout(() => this.loadData(), 500);
        } else {
            this.showMessage('Failed to add RFD. See console for details.', 'error');
        }
    }

    async updateRfd(rfdData) {
        const oldRfd = this.rfds.get(rfdData.mapId) || Array.from(this.rfds.values()).find(r=>r.mapId===rfdData.originalMapId);
        if (!oldRfd) return;

        // ----- Synchronise monitor arrays BEFORE we create merged object -----
        if(oldRfd.monitors && oldRfd.monitors.length){
            // Decide which monitor to update (editing index if set, else first)
            const idx = (this.editingMonitorIndex !== null) ? this.editingMonitorIndex : 0;
            if(oldRfd.monitors[idx]){
                const m = oldRfd.monitors[idx];
                m.name = rfdData.monitorName;
                m.tcoStatus = rfdData.tcoStatus;
                m.comments = rfdData.comments;
                m.creationDate = rfdData.creationDate;
                m.monitorType = rfdData.monitorType;
                m.currentThreshold = rfdData.currentThreshold;

                // Mirror to top level for backward compatibility
                rfdData.monitorName = m.name;
                rfdData.tcoStatus = m.tcoStatus;
                rfdData.comments = m.comments;
                rfdData.creationDate = m.creationDate;
                rfdData.monitorType = m.monitorType;
                rfdData.currentThreshold = m.currentThreshold;
            }
        }

        // Capture changes
        this.logChanges(oldRfd, rfdData);
        // Ensure merged.changeLog is the updated one
        const merged = { ...oldRfd, ...rfdData, position: oldRfd.position, changeLog: oldRfd.changeLog };
        // attach modifier metadata
        merged.updatedAt = new Date().toISOString();
        if(window.Auth && Auth.user && Auth.loggedIn){
            merged.updatedBy = Auth.user.username;
        } else if(window.currentUsername){
            merged.updatedBy = window.currentUsername;
        } else {
            const stored = localStorage.getItem('currentUsername');
            if(stored){ merged.updatedBy = stored; }
        }
        console.log('Saving changeLog:', merged.changeLog);
        const updated = await updateRfdInSupabase(toSupabaseRfd(merged, this.currentPanel));
        if (updated) {
            // Remove the old mapId key if it changed
            if (oldRfd.mapId !== updated.map_id) {
                this.rfds.delete(oldRfd.mapId);
            }
            this.rfds.set(updated.map_id, fromSupabaseRfd(updated));
            // Re-apply performance data after update
            if (this.latestRunsCsvText && this.latestRunsCsvText.trim().length > 0) {
                this.processRunsCsv(this.latestRunsCsvText);
            }
            this.renderRfds();
            this.selectRfd(updated.map_id);
            this.showMessage('RFD updated successfully!', 'success');
            // Optionally, also call await this.loadData(); to ensure full sync
        }

        // reset editing index after sync
        this.editingMonitorIndex = null;
    }

    logChanges(oldRfd,newData){
        const fields = Object.keys(newData).filter(k=>k!== 'position');
        if(!oldRfd.changeLog) oldRfd.changeLog={};
        fields.forEach(f=>{
            if(oldRfd[f]!==newData[f]){
                if(!oldRfd.changeLog[f]) oldRfd.changeLog[f]=[];
                oldRfd.changeLog[f].push({
                    date:new Date().toISOString(),
                    user:
                        (window.Auth && Auth.user && Auth.loggedIn && Auth.user.username) ? Auth.user.username :
                        (window.currentUsername) ? window.currentUsername :
                        (localStorage.getItem('currentUsername')) ? localStorage.getItem('currentUsername') :
                        'Unknown',
                    old:oldRfd[f]||'',
                    new:newData[f]||''
                });
            }
        });
    }

    showChangeLog(rfd,field,x,y){
        if(this.changeLogHideTimeout){clearTimeout(this.changeLogHideTimeout);} 
        const logs = (rfd.changeLog&&rfd.changeLog[field])||[];
        let html = `<strong>${field} change log (latest 3)</strong><br/>`;
        if(!logs.length){ html += '<em>No changes</em>'; }
        else{
            const recent = logs.slice(-3).reverse();
            html += '<ul style="margin:4px 0;padding-left:16px;">'+recent.map(l=>`<li>${new Date(l.date).toLocaleString()}<br/><span style=\"color:#888\">${l.old}</span> ➜ <span style=\"color:#000\">${l.new}</span></li>`).join('')+'</ul>';
        }
        html += `<div style="text-align:right;margin-top:4px;"><a href="#" onclick=\"app.openFullChangeLog('${rfd.id}');return false;\">Full log...</a></div>`;
        this.changeLogWindow.innerHTML = html;
        this.changeLogWindow.style.left = (x+10)+'px';
        this.changeLogWindow.style.top = (y+10)+'px';
        this.changeLogWindow.style.display='block';
    }

    async openFullChangeLog(id){
        // find RFD by UUID across panels
        let rfd = null;
        Object.values(this.panels).some(panel => {
            for (let r of panel.rfds.values()) {
                if (r.id === id) { rfd = r; return true; }
            }
            return false;
        });
        if(!rfd){
            // Fallback: fetch from Supabase
            const { data, error } = await window.supabase
                .from('rfds')
                .select('*')
                .eq('id', id)
                .single();
            if (data) {
                rfd = fromSupabaseRfd(data);
            } else {
                alert('RFD not found');
                return;
            }
        }
        const win = window.open('','_blank');
        const style = `<style>body{font-family:sans-serif;padding:20px;} h2{margin-top:0;} table{border-collapse:collapse;width:100%;} th,td{border:1px solid #ccc;padding:6px;} th{background:#f5f5f5;}</style>`;
        let html = `<html><head><title>${rfd.mapId} - Full Change Log</title>${style}</head><body>`;
        html += `<h2>Full Change Log for ${rfd.mapId}</h2>`;
        const fields = Object.keys(rfd.changeLog||{});
        if(!fields.length){ html += '<p>No changes recorded.</p>'; }
        else{
            fields.forEach(f=>{
                html += `<h3>${f}</h3><table><tr><th>Date</th><th>User</th><th>Old</th><th>New</th></tr>`;
                rfd.changeLog[f].slice().reverse().forEach(l=>{
                    html += `<tr><td>${new Date(l.date).toLocaleString()}</td><td>${l.user||'N/A'}</td><td>${l.old}</td><td>${l.new}</td></tr>`;
                });
                html += '</table>';
            });
        }
        html += '</body></html>';
        win.document.write(html);
        win.document.close();
    }

    hideChangeLog(){ this.changeLogWindow.style.display='none'; }

    async deleteRfd(rfdId) {
        if (!confirm('Are you sure you want to delete this RFD?')) return;
        const rfd = this.rfds.get(rfdId);
        if (!rfd) return;
        const success = await deleteRfdFromSupabase(rfd.id);
        if (success) {
            this.rfds.delete(rfdId);
            this.renderRfds();
            this.selectedRfd = null;
            this.displayRfdDetails(null);
            this.showMessage('RFD deleted successfully!', 'success');
        }
    }

    toggleMapLock() {
        this.isMapLocked = !this.isMapLocked;
        this.mapContainer.classList.toggle('map-locked', this.isMapLocked);
        
        const lockBtn = this.lockMapBtn;
        if (this.isMapLocked) {
            lockBtn.innerHTML = '<i class="fas fa-unlock"></i> Unlock Map';
            lockBtn.classList.remove('btn-secondary');
            lockBtn.classList.add('btn-primary');
        } else {
            lockBtn.innerHTML = '<i class="fas fa-lock"></i> Lock Map';
            lockBtn.classList.remove('btn-primary');
            lockBtn.classList.add('btn-secondary');
        }
        
        this.showMessage(
            this.isMapLocked ? 'Map locked - RFDs can be selected and viewed, but not moved' : 'Map unlocked - RFDs can be moved and resized',
            'warning'
        );
    }

    async performSearch() {
        const mode = this.searchMode.value;
        const scope = document.getElementById('searchScope')?.value || 'current';
        let query = '';
        if (mode === 'creationDate') {
            const start = document.getElementById('searchInputStart').value;
            const end = document.getElementById('searchInputEnd').value;
            query = { start, end };
        } else {
            const inputEl = document.getElementById('searchInput');
            query = inputEl ? inputEl.value.trim() : '';
        }
        if (!query && mode !== 'creationDate') return;

        const results = [];
        const panelsToSearch = scope === 'all'
            ? Object.entries(this.panels).map(([pid,p])=>({panelId:pid,panel:p}))
            : [{panelId:this.currentPanel,panel:this.panels[this.currentPanel]}];

        // Ensure we have fresh data for each panel before searching
        await Promise.all(panelsToSearch.map(async ({panelId,panel})=>{
            // Skip if current panel already loaded and has rfds
            if(panel.rfds && panel.rfds.size>0 && panelId===this.currentPanel) return;
            const rows = await fetchRfds(panelId);
            if(!panel.rfds) panel.rfds = new Map();
            else panel.rfds.clear();
            rows.forEach(r=>{
                const mapped = fromSupabaseRfd(r);
                panel.rfds.set(mapped.mapId, mapped);
            });
        }));

        panelsToSearch.forEach(({panelId,panel})=>{
            panel.rfds.forEach((rfd,mapId)=>{
                let matches=false;
                let matchedMonitor=null;
                switch(mode){
                    case 'mapId':
                        matches = mapId === query;
                        if(matches){ results.push({rfd,panelId,stationName:panel.name}); }
                        break;
                    case 'monitorName':
                        // push each monitor that matches
                        let any=false;
                        if(rfd.monitors && rfd.monitors.length){
                            rfd.monitors.forEach(m=>{
                                if(m.name.toLowerCase().includes(query.toLowerCase())){
                                    any=true;
                                    results.push({rfd,panelId,stationName:panel.name,matchedMonitor:m});
                                }
                            });
                        }
                        // legacy single monitor name field
                        if((rfd.monitorName||'').toLowerCase().includes(query.toLowerCase())){
                            any=true;
                            results.push({rfd,panelId,stationName:panel.name,matchedMonitor:{name:rfd.monitorName,currentThreshold:rfd.currentThreshold,tcoStatus:rfd.tcoStatus}});
                        }
                        matches=any;
                        break;
                    case 'tcoStatus': matches = !query || (rfd.tcoStatus||'')===query; break;
                    case 'comments': matches = (rfd.comments||'').toLowerCase().includes(query.toLowerCase()); break;
                    case 'creationDate':
                        if(!query.start && !query.end){ matches = true; break; }
                        const date = rfd.creationDate || '';
                        if(query.start && query.end){ matches = date>=query.start && date<=query.end; }
                        else if(query.start){ matches = date>=query.start; }
                        else if(query.end){ matches = date<=query.end; }
                        break;
                    case 'type': matches = !query || (rfd.type||'')===query; break;
                    case 'all': default: {
                        const queryLower = query.toLowerCase();
                        let anyAll = false;
                        // Check each monitor individually so we can surface each one
                        if(rfd.monitors && rfd.monitors.length){
                            rfd.monitors.forEach(m=>{
                                const text = `${mapId} ${m.name} ${rfd.tcoStatus} ${m.tcoStatus||''} ${m.comments||''} ${m.creationDate||''} ${rfd.comments||''}`.toLowerCase();
                                if(text.includes(queryLower)){
                                    anyAll = true;
                                    results.push({rfd,panelId,stationName:panel.name,matchedMonitor:m});
                                }
                            });
                        } else {
                            const singleText = `${mapId} ${rfd.monitorName} ${rfd.tcoStatus} ${rfd.comments} ${rfd.creationDate} ${rfd.type}`.toLowerCase();
                            if(singleText.includes(queryLower)){
                                anyAll = true;
                                results.push({rfd,panelId,stationName:panel.name,matchedMonitor:{name:rfd.monitorName,currentThreshold:rfd.currentThreshold,tcoStatus:rfd.tcoStatus}});
                            }
                        }
                        matches = anyAll;
                        break; }
                }
                if(matches){ results.push({rfd,panelId,stationName:panel.name,matchedMonitor}); }
            });
        });
        this.displaySearchResults(results, typeof query==='string'?query:'');
    }

    updateSearchPlaceholder() {
        const searchMode = this.searchMode.value;
        let placeholder = '';
        
        switch (searchMode) {
            case 'mapId':
                placeholder = 'Search by Map ID...';
                break;
            case 'monitorName':
                placeholder = 'Search by Monitor Name...';
                break;
            case 'tcoStatus':
                placeholder = 'Search by TCO Status...';
                break;
            case 'comments':
                placeholder = 'Search by Comments...';
                break;
            case 'creationDate':
                placeholder = 'Search by Creation Date...';
                break;
            case 'type':
                placeholder = 'Search by RFD Type...';
                break;
            case 'all':
            default:
                placeholder = 'Search RFDs, monitor names, or any field...';
                break;
        }
        
        this.searchInput.placeholder = placeholder;
    }

    // Copy selected RFD
    copySelectedRfd() {
        if (!this.selectedRfd) {
            this.showMessage('Please select an RFD to copy', 'warning');
            return;
        }

        // Deep copy the RFD data
        this.copiedRfd = JSON.parse(JSON.stringify(this.selectedRfd));
        this.showMessage(`Copied RFD: ${this.selectedRfd.mapId}`, 'success');
    }

    // Paste RFD with incremented ID
    pasteRfd() {
        if (!this.copiedRfd) {
            this.showMessage('No RFD copied. Select an RFD and press Ctrl+C or click Copy', 'warning');
            return;
        }

        // Generate new unique ID by incrementing the last digit
        const newMapId = this.generateIncrementedId(this.copiedRfd.mapId);
        
        // Create new RFD with incremented ID
        const newRfd = {
            ...this.copiedRfd,
            mapId: newMapId
        };

        // Add the new RFD
        this.addRfd(newRfd);
        
        // Select the newly created RFD
        this.selectRfd(newMapId);
        
        this.showMessage(`Pasted RFD: ${newMapId}`, 'success');
    }

    // Generate incremented ID by incrementing the last digit
    generateIncrementedId(originalId) {
        // Find the last digit in the ID
        const match = originalId.match(/(.*?)(\d+)$/);
        
        if (match) {
            const prefix = match[1];
            const lastNumber = parseInt(match[2]);
            let newNumber = lastNumber + 1;
            let newId = `${prefix}${newNumber}`;
            
            // Keep incrementing until we find an available ID
            while (this.rfds.has(newId)) {
                newNumber++;
                newId = `${prefix}${newNumber}`;
            }
            
            return newId;
        } else {
            // If no digit found, just add "1" at the end
            let newId = `${originalId}1`;
            let counter = 1;
            
            // Keep incrementing until we find an available ID
            while (this.rfds.has(newId)) {
                counter++;
                newId = `${originalId}${counter}`;
            }
            
            return newId;
        }
    }

    // Update copy/paste button states
    updateCopyPasteButtons() {
        const hasSelection = this.selectedRfd !== null;
        const hasCopiedRfd = this.copiedRfd !== null;
        
        // Enable/disable copy button based on selection
        this.copyRfdBtn.disabled = !hasSelection;
        this.copyRfdBtn.style.opacity = hasSelection ? '1' : '0.5';
        
        // Enable/disable paste button based on copied RFD
        this.pasteRfdBtn.disabled = !hasCopiedRfd;
        this.pasteRfdBtn.style.opacity = hasCopiedRfd ? '1' : '0.5';
        
        // Debug logging
        console.log('Copy/Paste buttons update:', {
            hasSelection,
            hasCopiedRfd,
            selectedRfd: this.selectedRfd ? this.selectedRfd.mapId : null
        });
    }

    displaySearchResults(results, query) {
        if (results.length === 0) {
            this.searchResults.innerHTML = `<div class="search-result-item"><h4>No results found</h4><p>No RFDs match your search for "${query}"</p></div>`;
        } else {
            this.searchResults.innerHTML = results.map(item => {
                const mon = item.matchedMonitor;
                const dispName = mon ? mon.name : item.rfd.monitorName;
                let thrVal = null;
                if(mon){
                    thrVal = (typeof mon.currentThreshold==='number') ? mon.currentThreshold : (typeof mon.currentThreshold==='string' && !isNaN(parseFloat(mon.currentThreshold)) ? parseFloat(mon.currentThreshold):null);
                }
                if(thrVal===null){
                    if(typeof item.rfd.currentThreshold==='number') thrVal=item.rfd.currentThreshold;
                    else if(typeof item.rfd.currentThreshold==='string' && !isNaN(parseFloat(item.rfd.currentThreshold))) thrVal=parseFloat(item.rfd.currentThreshold);
                }
                const thr = thrVal!==null? (+thrVal).toFixed(3):'N/A';
                const statusClass = this.getStatusClass(mon? mon.tcoStatus: item.rfd.tcoStatus);
                const statusText = (mon? mon.tcoStatus: item.rfd.tcoStatus) || 'Not set';
                return `<div class="search-result-item" onclick="app.selectRfdFromSearch('${item.panelId}','${item.rfd.mapId}')"><h4>${item.rfd.mapId} – ${dispName}</h4><p><strong>Status:</strong> <span class="${statusClass}">${statusText}</span></p><p><strong>Threshold:</strong> ${thr}</p><p><strong>Station:</strong> ${item.stationName}</p></div>`;
            }).join('');
        }
        this.showSearchModal();
    }

    selectRfdFromSearch(panelId,rfdId){
        this.closeSearchModal();
        if(panelId && panelId !== this.currentPanel){
            this.switchPanel(panelId);
        }
        this.selectRfd(rfdId);
        const el = document.querySelector(`[data-rfd-id="${rfdId}"]`);
        if(el){ el.scrollIntoView({behavior:'smooth',block:'center'}); }
    }

    // Map interaction methods
    handleMapClick(e) {
        if (this.isAddingRfd) return;
        
        // Clear selection when clicking on empty space
        if (e.target === this.mapContainer || e.target === this.panelImage || e.target === this.imageContainer) {
            this.clearSelection();
        }
    }

    handleMouseDown(e) {
        // Check for resize handle FIRST (highest priority)
        const resizeHandle = e.target.closest('.resize-handle');
        if (resizeHandle) {
            if (this.isMapLocked) return; // Prevent resizing when locked
            e.stopPropagation(); // Prevent other handlers
            this.isResizing = true;
            this.isDragging = false; // Ensure dragging is off
            this.resizeHandle = resizeHandle.dataset.handle;
            this.dragStart = { x: e.clientX, y: e.clientY };
            return;
        }
        
        const rfdElement = e.target.closest('.rfd');
        if (rfdElement && !this.isAddingRfd) {
            if (this.isMapLocked) {
                // When locked, just select the RFD without dragging
                const rfdId = rfdElement.dataset.rfdId;
                // Multi-select if Ctrl or Cmd is pressed
                this.selectRfd(rfdId, e.ctrlKey || e.metaKey || e.shiftKey);
                return;
            }
            // Prepare for possible dragging, but don't set isDragging yet
            // First, update selection (handles multi-select via Ctrl/Cmd)
            const rfdId = rfdElement.dataset.rfdId;
            this.selectRfd(rfdId, e.ctrlKey || e.metaKey || e.shiftKey);

            this.isDragging = false;
            this.isResizing = false; // Ensure resizing is off
            this.draggedElement = rfdElement;
            this.dragStart = { x: e.clientX, y: e.clientY };
            rfdElement.style.zIndex = '1000';
            // Store for drag threshold
            this._mouseDownAt = { x: e.clientX, y: e.clientY };
        } else if (this.isDrawing && (e.target === this.panelImage || e.target === this.imageContainer || e.target === this.mapContainer)) {
            // Start drawing
            this.drawingStart = { x: e.clientX, y: e.clientY };
            this.drawingElement.style.left = '0px';
            this.drawingElement.style.top = '0px';
            this.drawingElement.style.width = '0px';
            this.drawingElement.style.height = '0px';
            this.drawingElement.style.display = 'block';
        } else if (e.shiftKey && e.button === 0 && (e.target === this.panelImage || e.target === this.imageContainer || e.target === this.mapContainer)) {
            // Panning the map (only when Shift + left mouse button is held) - allowed when locked
            e.preventDefault(); // Prevent default drag behavior
            e.stopPropagation(); // Stop event bubbling
            this.isPanning = true;
            this.panStart = { x: e.clientX, y: e.clientY };
            this.mapContainer.style.cursor = 'grabbing';
            this.mapContainer.classList.add('panning');
        }
    }

    handleMouseMove(e) {
        // Throttle mouse move for better performance
        if (this.mouseMoveThrottle) return;
        this.mouseMoveThrottle = requestAnimationFrame(() => {
            this.mouseMoveThrottle = null;
            // Store mouse position for zoom-to-cursor functionality
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            // Only start dragging if mouse moved more than 3px
            if (this.draggedElement && this._mouseDownAt) {
                const dx = Math.abs(e.clientX - this._mouseDownAt.x);
                const dy = Math.abs(e.clientY - this._mouseDownAt.y);
                if (!this.isDragging && (dx > 3 || dy > 3)) {
                    this.isDragging = true;
                }
            }
            if (this.isResizing) {
                this.handleRfdResize(e);
            } else if (this.isDragging) {
                const rfdElement = this.draggedElement;
                if (!rfdElement) return;
                const deltaX = e.clientX - this.dragStart.x;
                const deltaY = e.clientY - this.dragStart.y;
                // Get current pixel position
                const currentLeft = parseFloat(rfdElement.style.left) || 0;
                const currentTop = parseFloat(rfdElement.style.top) || 0;
                // Convert screen-delta to base-delta (divide by zoom factor)
                const adjustedDeltaX = deltaX / this.currentZoom;
                const adjustedDeltaY = deltaY / this.currentZoom;
                // Update pixel position
                rfdElement.style.left = `${currentLeft + adjustedDeltaX}px`;
                rfdElement.style.top = `${currentTop + adjustedDeltaY}px`;
                this.dragStart = { x: e.clientX, y: e.clientY };
            }
            // Handle panning when Shift + left mouse button held
            else if (this.isPanning && e.shiftKey && e.buttons === 1) {
                e.preventDefault(); // Prevent default drag behavior
                const deltaX = e.clientX - this.panStart.x;
                const deltaY = e.clientY - this.panStart.y;
                this.panOffset.x += deltaX;
                this.panOffset.y += deltaY;
                this.applyPan();
                this.panStart = { x: e.clientX, y: e.clientY };
            } else if (this.isDrawing && this.drawingElement && this.drawingStart.x !== 0) {
                // Handle drawing rectangle during drawing mode
                const currentX = e.clientX;
                const currentY = e.clientY;
                const startX = this.drawingStart.x;
                const startY = this.drawingStart.y;
                const left = Math.min(startX, currentX);
                const top = Math.min(startY, currentY);
                const width = Math.abs(currentX - startX);
                const height = Math.abs(currentY - startY);
                this.drawingElement.style.left = `${left}px`;
                this.drawingElement.style.top = `${top}px`;
                this.drawingElement.style.width = `${width}px`;
                this.drawingElement.style.height = `${height}px`;
            }
        });
    }

    handleMouseUp() {
        if (this.isResizing) {
            this.isResizing = false;
            this.resizeHandle = null;

            // Persist the resized dimensions to Supabase
            const selEl = document.querySelector('.rfd.selected');
            if (selEl) {
                const rfdId = selEl.dataset.rfdId;
                const rfd = this.rfds.get(rfdId);
                if (rfd) {
                    // Fire-and-forget save (same pattern used for drag-save)
                    this.updateRfd(rfd);
                }
            }
        } else if (this.isDragging) {
            if (this.draggedElement) {
                this.draggedElement.style.zIndex = '';
                const rfdId = this.draggedElement.dataset.rfdId;
                const rfd = this.rfds.get(rfdId);
                if (rfd) {
                    // Convert pixel positions back to percentages relative to base image dimensions
                    const containerRect = this.rfdContainer.getBoundingClientRect();
                    const pixelX = parseFloat(this.draggedElement.style.left) || 0;
                    const pixelY = parseFloat(this.draggedElement.style.top) || 0;
                    // Calculate the base image dimensions (same as in updateRfdPositions)
                    const naturalWidth = this.panelImage.naturalWidth;
                    const naturalHeight = this.panelImage.naturalHeight;
                    const containerWidth = containerRect.width / this.currentZoom;
                    const containerHeight = containerRect.height / this.currentZoom;
                    const scaleToFit = Math.min(containerWidth / naturalWidth, containerHeight / naturalHeight);
                    const baseImageWidth = naturalWidth * scaleToFit;
                    const baseImageHeight = naturalHeight * scaleToFit;
                    const baseImageX = (containerWidth - baseImageWidth) / 2;
                    const baseImageY = (containerHeight - baseImageHeight) / 2;
                    // Convert to percentages relative to base image dimensions
                    const percentX = ((pixelX - baseImageX) / baseImageWidth) * 100;
                    const percentY = ((pixelY - baseImageY) / baseImageHeight) * 100;
                    rfd.position.x = percentX;
                    rfd.position.y = percentY;
                    this.updateRfd(rfd); // Save position changes to Supabase
                }
                this.draggedElement = null;
            }
            this.isDragging = false;
        } else if (this.draggedElement && !this.isDragging) {
            // Simple click: just select (including multi-select)
            const rfdId = this.draggedElement.dataset.rfdId;
            // Multi-select if Ctrl or Cmd is pressed
            const event = window.event;
            this.selectRfd(rfdId, event && (event.ctrlKey || event.metaKey || event.shiftKey));
            this.draggedElement.style.zIndex = '';
            this.draggedElement = null;
        } else if (this.isDrawing && this.drawingElement && this.drawingStart.x !== 0) {
            // Finish drawing and create RFD
            this.finishDrawing();
        } else if (this.isPanning) {
            this.isPanning = false;
            this.mapContainer.style.cursor = '';
            this.mapContainer.classList.remove('shift-pressed');
            this.mapContainer.classList.remove('panning');
        }
    }

    handleWheel(e) {
        e.preventDefault();
        
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.5, Math.min(5, this.currentZoom * zoomFactor));
        this.zoomToPoint(newZoom, 0.5);
    }

    clearSelection() {
        document.querySelectorAll('.rfd.selected').forEach(el => {
            el.classList.remove('selected');
        });
        this.selectedRfd = null;
        this.multiSelectedIds.clear();
        this.updateDetailsPanel();
        
        // Update resize handle sizes when selection is cleared
        this.updateResizeHandleSizes();
        
        // Update copy/paste button states
        this.updateCopyPasteButtons();
    }

    // Zoom functionality
    zoomIn() {
        this.zoomToPoint(this.currentZoom + 0.2, 5);
    }

    zoomOut() {
        this.zoomToPoint(this.currentZoom - 0.2, 0.5);
    }

    zoomToPoint(newZoom, minMax) {
        // Get current mouse position relative to the map container
        const containerRect = this.mapContainer.getBoundingClientRect();
        const mouseX = (this.lastMouseX || containerRect.width / 2) - containerRect.left;
        const mouseY = (this.lastMouseY || containerRect.height / 2) - containerRect.top;
        
        // Calculate zoom center point
        const zoomCenterX = mouseX / this.currentZoom;
        const zoomCenterY = mouseY / this.currentZoom;
        
        // Apply new zoom
        const oldZoom = this.currentZoom;
        this.currentZoom = Math.max(minMax, Math.min(5, newZoom));
        
        // Calculate new pan offset to keep the zoom center point under the mouse
        const zoomRatio = this.currentZoom / oldZoom;
        this.panOffset.x = zoomCenterX * (1 - zoomRatio) + this.panOffset.x * zoomRatio;
        this.panOffset.y = zoomCenterY * (1 - zoomRatio) + this.panOffset.y * zoomRatio;
        
        // Apply boundaries after zoom calculation
        this.applyZoom();
    }

    resetZoom() {
        this.currentZoom = 1;
        this.panOffset = { x: 0, y: 0 };
        this.applyZoom();
    }

    zoomInAtCursor() {
        // Use the last known mouse position or center of the container
        const containerRect = this.mapContainer.getBoundingClientRect();
        const mouseX = this.lastMouseX || containerRect.width / 2;
        const mouseY = this.lastMouseY || containerRect.height / 2;
        
        // Calculate zoom center point relative to the container
        const zoomCenterX = (mouseX - containerRect.left) / this.currentZoom;
        const zoomCenterY = (mouseY - containerRect.top) / this.currentZoom;
        
        // Apply zoom increase - increased from 0.5 to 1.0 for more zoom
        const oldZoom = this.currentZoom;
        this.currentZoom = Math.min(5, this.currentZoom + 1.0); // Zoom in by 1.0 (max zoom increased to 5x)
        
        // Calculate new pan offset to keep the zoom center point under the mouse
        const zoomRatio = this.currentZoom / oldZoom;
        this.panOffset.x = zoomCenterX * (1 - zoomRatio) + this.panOffset.x * zoomRatio;
        this.panOffset.y = zoomCenterY * (1 - zoomRatio) + this.panOffset.y * zoomRatio;
        
        // Apply the zoom with boundaries
        this.applyZoom();
    }

    applyZoom() {
        const transform = `scale(${this.currentZoom}) translate(${this.panOffset.x / this.currentZoom}px, ${this.panOffset.y / this.currentZoom}px)`;
        this.imageContainer.style.transform = transform;
        
        // Update resize handle sizes based on zoom level
        this.updateResizeHandleSizes();
        
        // Update RFD border thickness based on zoom level
        this.updateRfdBorderThickness();
    }

    applyPan() {
        // Calculate boundaries to keep image within container
        const containerRect = this.mapContainer.getBoundingClientRect();
        
        // Use original image dimensions for proper boundary calculation
        const originalWidth = this.panelImage.naturalWidth;
        const originalHeight = this.panelImage.naturalHeight;
        
        // Calculate scaled dimensions
        const scaledWidth = originalWidth * this.currentZoom;
        const scaledHeight = originalHeight * this.currentZoom;
        
        // Calculate max allowed pan offsets to keep image within bounds
        const maxPanX = Math.max(0, (scaledWidth - containerRect.width) / 2);
        const maxPanY = Math.max(0, (scaledHeight - containerRect.height) / 2);
        
        // Clamp pan offsets to keep image within bounds
        const clampedPanX = Math.max(-maxPanX, Math.min(maxPanX, this.panOffset.x));
        const clampedPanY = Math.max(-maxPanY, Math.min(maxPanY, this.panOffset.y));
        
        const transform = `scale(${this.currentZoom}) translate(${clampedPanX / this.currentZoom}px, ${clampedPanY / this.currentZoom}px)`;
        this.imageContainer.style.transform = transform;
    }

    updateRfdPositions() {
        // Get the container bounds
        const containerRect = this.rfdContainer.getBoundingClientRect();
        
        // Get the natural image dimensions (original size)
        const naturalWidth = this.panelImage.naturalWidth;
        const naturalHeight = this.panelImage.naturalHeight;
        
        // Calculate the base image dimensions (without zoom/pan transformations)
        // We need to calculate what the image dimensions would be at 1x zoom with no pan.
        // containerRect is already scaled by currentZoom, so divide it out to get the base size.
        const containerWidth = containerRect.width  / this.currentZoom;
        const containerHeight = containerRect.height / this.currentZoom;
        
        // Calculate the scale to fit the image in the container at 1x zoom
        const scaleToFit = Math.min(containerWidth / naturalWidth, containerHeight / naturalHeight);
        const baseImageWidth = naturalWidth * scaleToFit;
        const baseImageHeight = naturalHeight * scaleToFit;
        
        // Calculate the base image position (centered in container at 1x zoom)
        const baseImageX = (containerWidth - baseImageWidth) / 2;
        const baseImageY = (containerHeight - baseImageHeight) / 2;
        
        this.rfds.forEach((rfd, id) => {
            const rfdElement = document.querySelector(`[data-rfd-id="${id}"]`);
            if (rfdElement) {
                // Convert percentage positions to actual pixel positions relative to the base image
                const x = (rfd.position.x / 100) * baseImageWidth + baseImageX;
                const y = (rfd.position.y / 100) * baseImageHeight + baseImageY;
                const width = (rfd.position.width / 100) * baseImageWidth;
                const height = (rfd.position.height / 100) * baseImageHeight;
                
                // Apply the positions
                rfdElement.style.left = `${x}px`;
                rfdElement.style.top = `${y}px`;
                rfdElement.style.width = `${width}px`;
                rfdElement.style.height = `${height}px`;
            }
        });
    }

    updateResizeHandleSizes() {
        // Calculate the appropriate scale for resize handles based on zoom level
        // At 1x zoom, scale = 1. At higher zoom, scale decreases to keep handles manageable
        const baseScale = 1;
        const maxZoom = 5;
        const scaleFactor = Math.max(0.3, Math.min(1, baseScale / this.currentZoom));
        
        // Apply the scale to all resize handles
        document.querySelectorAll('.resize-handle').forEach(handle => {
            handle.style.transform = `scale(${scaleFactor})`;
        });
    }

    updateRfdBorderThickness() {
        // Calculate border thickness based on zoom level
        // At 1x zoom: 2px, at 2x zoom: 1px, at 3x zoom: 0.5px, etc.
        const baseThickness = 2;
        const thickness = Math.max(0.5, baseThickness / this.currentZoom);
        
        // Apply border thickness to all RFD elements
        document.querySelectorAll('.rfd').forEach(rfd => {
            rfd.style.borderWidth = `${thickness}px`;
        });
    }

    // Modal management
    showModal() {
        this.rfdModal.style.display = 'block';
        this.mapIdInput.focus();
    }

    closeModal() {
        this.rfdModal.style.display = 'none';
        this.isAddingRfd = false;
        this.stopDrawingMode();
    }

    startDrawingMode() {
        this.isDrawing = true;
        this.mapContainer.classList.add('drawing-mode');
        this.showMessage('Click and drag to draw the RFD area. Press ESC to cancel.', 'info');
        
        // Add drawing element
        this.drawingElement = document.createElement('div');
        this.drawingElement.className = 'drawing-element';
        this.rfdContainer.appendChild(this.drawingElement);
    }

    stopDrawingMode() {
        this.isDrawing = false;
        this.mapContainer.classList.remove('drawing-mode');
        
        if (this.drawingElement) {
            this.drawingElement.remove();
            this.drawingElement = null;
        }
    }

    showSearchModal() {
        this.searchModal.style.display = 'block';
    }

    closeSearchModal() {
        this.searchModal.style.display = 'none';
        this.searchInput.value = '';
    }

    closeSidebar() {
        this.clearSelection();
    }

    // Utility methods
    showMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.remove();
        }, 3000);
    }

    handleKeydown(e) {
        if (e.key === 'Escape') {
            this.closeModal();
            this.closeSearchModal();
            this.stopDrawingMode();
        } else if (e.ctrlKey) {
            // Copy and paste shortcuts
            if (e.key === 'c') {
                e.preventDefault();
                this.copySelectedRfd();
            } else if (e.key === 'v') {
                e.preventDefault();
                this.pasteRfd();
            }
        } else if (e.key === 'Shift') {
            this.isShiftPressed = true;
            this.mapContainer.classList.add('shift-pressed');
        } else if (e.shiftKey) {
            // Shift + number shortcuts
            if (e.key === '1' || e.key === 'Digit1' || e.key === '!') {
                e.preventDefault();
                this.resetZoom();
                this.showMessage('🔄 View reset to full screen (Shift+1)', 'success');
            } else if (e.key === '2' || e.key === 'Digit2' || e.key === '@') {
                e.preventDefault();
                this.zoomInAtCursor();
                this.showMessage('🔍 Zoomed in at cursor position (Shift+2)', 'success');
            }
        }
    }

    handleKeyup(e) {
        if (e.key === 'Shift') {
            this.isShiftPressed = false;
            this.mapContainer.classList.remove('shift-pressed');
            // Stop panning if it was active
            if (this.isPanning) {
                this.isPanning = false;
                this.mapContainer.style.cursor = '';
                this.mapContainer.classList.remove('panning');
            }
        }
    }

    handleRfdResize(e) {
        try {
            const rfdElement = document.querySelector('.rfd.selected');
            if (!rfdElement || !this.resizeHandle) {
                return;
            }

            const deltaX = e.clientX - this.dragStart.x;
            const deltaY = e.clientY - this.dragStart.y;
        
            // Get the current RFD data
            const rfdId = rfdElement.dataset.rfdId;
            const rfd = this.rfds.get(rfdId);
            if (!rfd) {
                return;
            }
            
            // Calculate the base image dimensions (same as in updateRfdPositions)
            const containerRect = this.rfdContainer.getBoundingClientRect();
            const naturalWidth = this.panelImage.naturalWidth;
            const naturalHeight = this.panelImage.naturalHeight;
            const containerWidth = containerRect.width / this.currentZoom;
            const containerHeight = containerRect.height / this.currentZoom;
            const scaleToFit = Math.min(containerWidth / naturalWidth, containerHeight / naturalHeight);
            const baseImageWidth = naturalWidth * scaleToFit;
            const baseImageHeight = naturalHeight * scaleToFit;
            
            // Convert screen-delta to base-delta (divide by zoom factor)
            const adjustedDeltaX = deltaX / this.currentZoom;
            const adjustedDeltaY = deltaY / this.currentZoom;
            const deltaXPercent = (adjustedDeltaX / baseImageWidth) * 100;
            const deltaYPercent = (adjustedDeltaY / baseImageHeight) * 100;
            
            // Get current position from RFD data
            let newLeft = rfd.position.x;
            let newTop = rfd.position.y;
            let newWidth = rfd.position.width;
            let newHeight = rfd.position.height;
            
            switch (this.resizeHandle) {
                case 'nw':
                    newLeft += deltaXPercent;
                    newTop += deltaYPercent;
                    newWidth -= deltaXPercent;
                    newHeight -= deltaYPercent;
                    break;
                case 'n':
                    newTop += deltaYPercent;
                    newHeight -= deltaYPercent;
                    break;
                case 'ne':
                    newTop += deltaYPercent;
                    newWidth += deltaXPercent;
                    newHeight -= deltaYPercent;
                    break;
                case 'e':
                    newWidth += deltaXPercent;
                    break;
                case 'se':
                    newWidth += deltaXPercent;
                    newHeight += deltaYPercent;
                    break;
                case 's':
                    newHeight += deltaYPercent;
                    break;
                case 'sw':
                    newLeft += deltaXPercent;
                    newWidth -= deltaXPercent;
                    newHeight += deltaYPercent;
                    break;
                case 'w':
                    newLeft += deltaXPercent;
                    newWidth -= deltaXPercent;
                    break;
            }
            
            // Clamp values to keep the RFD inside the image bounds and avoid negative sizes
            const minPercent = 0.5;                    // minimum size
            newWidth  = Math.max(minPercent, Math.min(100, newWidth));
            newHeight = Math.max(minPercent, Math.min(100, newHeight));
            newLeft   = Math.max(0, Math.min(100 - newWidth,  newLeft));
            newTop    = Math.max(0, Math.min(100 - newHeight, newTop));
            
            // Update RFD data first
            rfd.position.x = newLeft;
            rfd.position.y = newTop;
            rfd.position.width = newWidth;
            rfd.position.height = newHeight;
            
            // Update the element using the new positioning system
            this.updateRfdPositions();
            
            // Update drag start position for next frame
            this.dragStart = { x: e.clientX, y: e.clientY };
            
        } catch (error) {
            console.error('Error in handleRfdResize:', error);
        }
    }

    finishDrawing() {
        if (!this.drawingElement) return;
        
        const rect = this.drawingElement.getBoundingClientRect();
        const containerRect = this.rfdContainer.getBoundingClientRect();
        
        // Calculate the base image dimensions (same as in updateRfdPositions)
        const naturalWidth = this.panelImage.naturalWidth;
        const naturalHeight = this.panelImage.naturalHeight;
        const containerWidth = containerRect.width / this.currentZoom;
        const containerHeight = containerRect.height / this.currentZoom;
        const scaleToFit = Math.min(containerWidth / naturalWidth, containerHeight / naturalHeight);
        const baseImageWidth = naturalWidth * scaleToFit;
        const baseImageHeight = naturalHeight * scaleToFit;
        const baseImageX = (containerWidth - baseImageWidth) / 2;
        const baseImageY = (containerHeight - baseImageHeight) / 2;
        
        // Convert to percentage based on base image dimensions
        const left = ((rect.left - containerRect.left - baseImageX) / baseImageWidth) * 100;
        const top = ((rect.top - containerRect.top - baseImageY) / baseImageHeight) * 100;
        const width = (rect.width / baseImageWidth) * 100;
        const height = (rect.height / baseImageHeight) * 100;
        
        // Update form with position
        const positionInput = document.createElement('input');
        positionInput.type = 'hidden';
        positionInput.name = 'position';
        positionInput.value = JSON.stringify({ x: left, y: top, width, height });
        this.rfdForm.appendChild(positionInput);
        
        // Stop drawing mode
        this.stopDrawingMode();
        this.drawingStart = { x: 0, y: 0 };
        
        this.showMessage('RFD area drawn! Fill in the details and save.', 'success');
    }

    getImageBounds() {
        const imageRect = this.panelImage.getBoundingClientRect();
        const containerRect = this.rfdContainer.getBoundingClientRect();
        
        // Calculate the actual image bounds within the container
        const imageLeft = Math.max(containerRect.left, imageRect.left);
        const imageTop = Math.max(containerRect.top, imageRect.top);
        const imageRight = Math.min(containerRect.right, imageRect.right);
        const imageBottom = Math.min(containerRect.bottom, imageRect.bottom);
        
        const bounds = {
            left: imageLeft,
            top: imageTop,
            width: imageRight - imageLeft,
            height: imageBottom - imageTop
        };
        
        console.log('Image bounds calculated:', {
            containerRect: { left: containerRect.left, top: containerRect.top, width: containerRect.width, height: containerRect.height },
            imageRect: { left: imageRect.left, top: imageRect.top, width: imageRect.width, height: imageRect.height },
            calculatedBounds: bounds
        });
        
        return bounds;
    }

    handleResize() {
        // Recalculate positions when window resizes
        this.updateRfdPositions();
    }

    // Settings functionality
    initializeSettings() {
        // Settings modal elements
        this.settingsModal = document.getElementById('settingsModal');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.closeSettingsBtn = document.getElementById('closeSettingsBtn');
        this.stationsList = document.getElementById('stationsList');

        // Settings event listeners
        this.settingsBtn.addEventListener('click', () => this.openSettingsModal());
        this.closeSettingsBtn.addEventListener('click', () => this.closeSettingsModal());
        
        // Add new station functionality
        this.newStationName = document.getElementById('newStationName');
        this.addStationBtn = document.getElementById('addStationBtn');
        this.addStationBtn.addEventListener('click', () => this.addNewStation());
        
        // Theme toggle functionality
        this.themeToggleBtn = document.getElementById('themeToggleBtn');
        this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
        
        // Fullscreen functionality
        this.fullscreenBtn = document.getElementById('fullscreenBtn');
        this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        
        // Reset panel configuration button
        this.resetPanelConfigBtn = document.getElementById('resetPanelConfigBtn');
        this.resetPanelConfigBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset the panel configuration to defaults? This will clear any custom image settings.')) {
                this.resetPanelConfiguration();
                this.populateStationsList();
                this.showMessage('Panel configuration reset to defaults!', 'success');
            }
        });

        // Close modal when clicking outside
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) {
                this.closeSettingsModal();
            }
        });

        // Populate stations list
        this.populateStationsList();
    }

    openSettingsModal() {
        this.settingsModal.style.display = 'block';
        this.populateStationsList();
    }

    closeSettingsModal() {
        this.settingsModal.style.display = 'none';
    }



    populateStationsList() {
        this.stationsList.innerHTML = '';
        
        Object.entries(this.panels).forEach(([panelId, panel]) => {
            const stationItem = document.createElement('div');
            stationItem.className = 'station-item';
            
            const stationContent = document.createElement('div');
            stationContent.className = 'station-content';
            
            // Station name
            const stationName = document.createElement('h3');
            stationName.textContent = panel.name;
            stationContent.appendChild(stationName);
            
            // Station image info
            const imageInfo = document.createElement('p');
            imageInfo.className = 'station-image-info';
            imageInfo.textContent = `Image: ${panel.image}`;
            stationContent.appendChild(imageInfo);
            
            // Station actions
            const stationActions = document.createElement('div');
            stationActions.className = 'station-actions';
            
            const deleteStationBtn = document.createElement('button');
            deleteStationBtn.className = 'delete-station-btn';
            deleteStationBtn.innerHTML = '<i class="fas fa-trash"></i> Delete';
            deleteStationBtn.onclick = () => this.deleteStation(panelId);
            
            stationActions.appendChild(deleteStationBtn);
            
            stationItem.appendChild(stationContent);
            stationItem.appendChild(stationActions);
            
            this.stationsList.appendChild(stationItem);
        });
    }





    addNewTab(panelId, stationName) {
        const panelTabs = document.querySelector('.panel-tabs');
        const settingsTab = document.getElementById('settingsBtn');
        
        // Create new tab
        const newTab = document.createElement('button');
        newTab.className = 'panel-tab';
        newTab.setAttribute('data-panel', panelId);
        newTab.innerHTML = `<i class="fas fa-microchip"></i> ${stationName}`;
        
        // Add click event
        newTab.addEventListener('click', (e) => {
            const panelId = e.currentTarget.getAttribute('data-panel');
            this.switchPanel(panelId);
        });
        
        // Insert before settings tab
        panelTabs.insertBefore(newTab, settingsTab);
    }



    deleteStation(panelId) {
        if (Object.keys(this.panels).length <= 1) {
            this.showMessage('Cannot delete the last station. At least one station must remain.', 'error');
            return;
        }
        
        const stationName = this.panels[panelId].name;
        
        if (confirm(`Are you sure you want to delete "${stationName}"? This will also delete all RFD data for this station.`)) {
            // Remove panel data
            delete this.panels[panelId];
            
            // Remove from localStorage
            localStorage.removeItem(`ateMonitorRfds_${panelId}`);
            
            // Switch to another panel if current panel is deleted
            if (this.currentPanel === panelId) {
                const remainingPanels = Object.keys(this.panels);
                if (remainingPanels.length > 0) {
                    this.switchPanel(remainingPanels[0]);
                }
            }
            
            // Remove tab
            const tabToRemove = document.querySelector(`[data-panel="${panelId}"]`);
            if (tabToRemove) {
                tabToRemove.remove();
            }
            
            // Persist updated panel configuration
            this.savePanelConfiguration();
 
            this.populateStationsList();
            this.showMessage(`Station "${stationName}" deleted successfully!`, 'success');
        }
    }







    // Save panel configuration to localStorage
    savePanelConfiguration() {
        try {
            const panelConfig = {};
            Object.entries(this.panels).forEach(([panelId, panel]) => {
                panelConfig[panelId] = {
                    name: panel.name,
                    image: panel.image,
                    runsFile: panel.runsFile || ''
                };
            });
            localStorage.setItem('ateMonitorPanelConfig', JSON.stringify(panelConfig));
            console.log('Panel configuration saved to localStorage');
        } catch (error) {
            console.error('Error saving panel configuration:', error);
        }
    }

    // Load panel configuration from localStorage
    loadPanelConfiguration() {
        try {
            const savedConfig = localStorage.getItem('ateMonitorPanelConfig');
            if (savedConfig) {
                const panelConfig = JSON.parse(savedConfig);
                let hasOldImages = false;
                
                Object.entries(panelConfig).forEach(([panelId, config]) => {
                    if (this.panels[panelId]) {
                        this.panels[panelId].name = config.name;
                        this.panels[panelId].runsFile = config.runsFile || this.panels[panelId].runsFile;
                        // Check if any images are using old timestamp format
                        if (config.image.startsWith('station-')) {
                            hasOldImages = true;
                        } else {
                            this.panels[panelId].image = config.image;
                        }
                    } else {
                        // Add brand-new panel saved in previous session
                        this.panels[panelId] = {
                            rfds: new Map(),
                            image: config.image,
                            name: config.name,
                            runsFile: config.runsFile || ''
                        };
                        // Also add tab in UI
                        this.addNewTab(panelId, config.name);
                    }
                });
                
                // If we found old timestamp-based images, reset to defaults
                if (hasOldImages) {
                    console.log('Found old timestamp-based images, resetting to default configuration');
                    this.resetPanelConfiguration();
                } else {
                    console.log('Panel configuration loaded from localStorage');
                }
            }
        } catch (error) {
            console.error('Error loading panel configuration:', error);
        }
    }

    // Reset panel configuration to default values
    resetPanelConfiguration() {
        this.panels = {
            panel1: {
                rfds: new Map(),
                image: 'electrical-panel-real.jpg',
                name: 'Integration'
            },
            panel2: {
                rfds: new Map(),
                image: 'inverter-vision-station-1.jpg',
                name: 'Inverter Vision Station 1'
            },
            panel3: {
                rfds: new Map(),
                image: 'inverter-vision-station-2.jpg',
                name: 'Inverter Vision Station 2'
            },
            panel4: {
                rfds: new Map(),
                image: 'inverter-vision-station-3.jpg',
                name: 'Inverter Vision Station 3'
            },
            panel5: {
                rfds: new Map(),
                image: 'inverter-vision-station-4.jpg',
                name: 'Inverter Vision Station 4'
            }
        };
        
        // Save the new configuration
        this.savePanelConfiguration();
        console.log('Panel configuration reset to defaults');
    }

    // Add new station
    addNewStation() {
        const stationName = this.newStationName.value.trim();
        
        if (!stationName) {
            this.showMessage('Please enter a station name', 'error');
            return;
        }
        
        // Check if station name already exists
        const existingStation = Object.values(this.panels).find(panel => 
            panel.name.toLowerCase() === stationName.toLowerCase()
        );
        
        if (existingStation) {
            this.showMessage(`Station "${stationName}" already exists`, 'error');
            return;
        }
        
        // Generate unique panel ID
        const panelId = `panel${Date.now()}`;
        
        // Create image filename based on station name
        const imageName = stationName.toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '') + '.jpg';
        
        // Add new panel
        this.panels[panelId] = {
            rfds: new Map(),
            image: imageName,
            name: stationName
        };
        
        // Save panel configuration
        this.savePanelConfiguration();
        
        // Add new tab
        this.addNewTab(panelId, stationName);
        
        // Clear form
        this.newStationName.value = '';
        
        // Refresh stations list
        this.populateStationsList();
        
        this.showMessage(`Station "${stationName}" added successfully! Add image file: ${imageName}`, 'success');
    }

    // Toggle dark/light theme
    toggleTheme() {
        const body = document.body;
        const isDark = body.classList.contains('dark-theme');
        
        if (isDark) {
            body.classList.remove('dark-theme');
            this.themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
            localStorage.setItem('theme', 'light');
            this.showMessage('Switched to light theme', 'success');
        } else {
            body.classList.add('dark-theme');
            this.themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
            localStorage.setItem('theme', 'dark');
            this.showMessage('Switched to dark theme', 'success');
        }
    }

    // Toggle fullscreen mode
    toggleFullscreen() {
        const container = document.querySelector('.container');
        const isFullscreen = container.classList.contains('fullscreen');
        
        if (isFullscreen) {
            container.classList.remove('fullscreen');
            this.fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
            this.fullscreenBtn.title = 'Toggle Fullscreen';
            this.showMessage('Exited fullscreen mode', 'success');
        } else {
            container.classList.add('fullscreen');
            this.fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
            this.fullscreenBtn.title = 'Exit Fullscreen';
            this.showMessage('Entered fullscreen mode', 'success');
        }
    }

    // Load saved theme
    loadTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
            this.themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
        }
    }

    // Load initial panel image
    loadInitialPanelImage() {
        const currentPanel = this.panels[this.currentPanel];
        const panelImage = currentPanel.image;
        
        // Load image from program directory
        this.panelImage.src = panelImage;
        console.log(`Loading initial image: ${panelImage}`);
        
        // Add event listener for when image loads
        this.panelImage.onload = () => {
            console.log('Panel image loaded, updating RFD positions');
            // Add a small delay to ensure the image is fully rendered
            setTimeout(() => {
                this.updateRfdPositions();
            }, 100);
        };
    }

    /* ================== Performance CSV Import =================== */
    importPerformanceCsv() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,text/csv';

        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const text = event.target.result.trim();
                    this.processPerformanceCsv(text);
                } catch (error) {
                    console.error('Error reading CSV:', error);
                    this.showMessage('Error reading CSV file', 'error');
                }
            };
            reader.readAsText(file);
        };

        input.click();
    }

    /**
     * Parse CSV string: expects header MonitorID,ModelVersion,AvgConfidence,Threshold
     */
    processPerformanceCsv(csvText) {
        const lines = csvText.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) {
            this.showMessage('CSV has no data', 'warning');
            return;
        }

        const header = lines[0].split(',').map(h => h.trim());
        const expected = ['MonitorID','ModelVersion','AvgConfidence','Threshold'];
        const headerOk = expected.every((h,i)=> header[i] && header[i].toLowerCase()===h.toLowerCase());
        if (!headerOk) {
            this.showMessage('CSV header must be: ' + expected.join(', '), 'error');
            return;
        }

        let okCount = 0, underCount = 0, total = 0, maxVersion = '0';
        const missingIds = [];

        for (let i=1;i<lines.length;i++) {
            const parts = lines[i].split(',');
            if (parts.length<4) continue;
            const [id, versionStr, avgStr, thrStr] = parts.map(p=>p.trim());
            if (!id) continue;
            total++;

            const rfd = this.rfds.get(id);
            if (!rfd) {
                missingIds.push(id);
                continue;
            }

            const avg = parseFloat(avgStr);
            const thr = parseFloat(thrStr);
            const delta = +(avg - thr).toFixed(4);

            rfd.modelVersion = versionStr;
            rfd.avgConf = avg;
            rfd.threshold = thr;
            rfd.delta = delta;

            const status = avg >= thr ? 'OK' : 'Underperform';
            rfd.performanceStatus = status;

            status === 'OK' ? okCount++ : underCount++;

            // track max version (string compare vXYZ). remove non-numeric.
            if (versionStr && versionStr > maxVersion) maxVersion = versionStr;
        }

        if (missingIds.length) {
            this.showMessage('Unknown MonitorID(s): ' + missingIds.join(', '), 'warning');
        }

        // Update visuals
        this.updatePerformanceColors();
        this.updatePerformanceSummary(maxVersion, total, okCount, underCount);

        this.showMessage(`Imported CSV. Total ${total}, OK ${okCount}, Underperform ${underCount}`, 'success');
    }

    updatePerformanceColors() {
        this.rfds.forEach((rfd,id)=>{
            const elem = document.querySelector(`[data-rfd-id="${id}"]`);
            if (!elem) return;
            // Reset any previous outline
            elem.style.outline = '';
            if (rfd.performanceStatus === 'Underperform') {
                elem.style.outline = '2px solid #e74c3c';
            } else if (rfd.performanceStatus === 'OK') {
                elem.style.outline = '2px solid #27ae60';
            }
            // Simple tooltip: monitor name and latest value vs threshold
            const hasVal = typeof rfd.avgConf === 'number' && !Number.isNaN(rfd.avgConf);
            const valStr = hasVal ? rfd.avgConf.toFixed(3) : 'N/A';
            let thrVal=null;
            if(typeof rfd.threshold==='number' && rfd.threshold!==0.7) thrVal=rfd.threshold;
            else if(typeof rfd.currentThreshold==='number') thrVal=rfd.currentThreshold;
            else if(typeof rfd.currentThreshold==='string' && !isNaN(parseFloat(rfd.currentThreshold))) thrVal=parseFloat(rfd.currentThreshold);
            const thrStr = (thrVal!==null)? thrVal.toFixed(3) : 'N/A';
            let tooltipLines=[];
            if(rfd.monitors && rfd.monitors.length){
                rfd.monitors.forEach(m=>{
                    const th=(typeof m.currentThreshold==='number')?m.currentThreshold.toFixed(3): (m.currentThreshold||'N/A');
                    const valLine = (typeof m.avgConf==='number' && !Number.isNaN(m.avgConf)) ? m.avgConf.toFixed(3) : 'N/A';
                    tooltipLines.push(`${m.name}: ${valLine}/${th}`);
                });
            }else{
                tooltipLines.push(`${rfd.monitorName}: ${valStr}/${thrStr}`);
            }
            elem.title = tooltipLines.join('\n');

            // Keep selection visible even after performance outline changes
            if (elem.classList.contains('selected')) {
                elem.style.outline = '2px dashed #2980b9';
            }
        });

        // ensure legend visible
        if (this.performanceLegend) this.performanceLegend.style.display='block';
    }

    updatePerformanceSummary(version,total,ok,under) {
        if (!this.performanceSummary) return;
        const pct = total? Math.round((ok/total)*100):0;
        this.performanceSummary.innerHTML = `Version: <strong>${version}</strong><br/>Monitors: ${total} &nbsp; OK: ${ok} &nbsp; Under: ${under}<br/>% Good: ${pct}% <span id="seeUnderBtn" style="text-decoration:underline;cursor:pointer;">See underperformers</span>`;
        this.performanceSummary.style.display='block';

        // Attach click once
        setTimeout(()=>{
            const btn=document.getElementById('seeUnderBtn');
            if(btn){btn.onclick = ()=>this.showUnderperformers();}
        },0);
    }

    showUnderperformers() {
        // Find all RFDs that are marked as under-performing
        const under = Array.from(this.rfds.values()).filter(r => r.performanceStatus === 'Underperform');

        if (!under.length) {
            this.showMessage('All monitors OK!', 'success');
            return;
        }

        // Clear any existing selection first
        this.clearSelection();

        // Select every under-performing RFD.
        // First item: single-select (clears and sets base selection), others: multi-select toggle.
        under.forEach((r, idx) => {
            const isMulti = idx !== 0; // first uses single-select, rest use multi-select
            this.selectRfd(r.mapId, isMulti);
        });

        // Open the performance page for the selected monitors in a new tab
        this.openMultiPerformancePage();
    }

    /* ================== ML Runs CSV Import =================== */
    importRunsCsv() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,text/csv';

        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const csvText = event.target.result.trim();
                    this.latestRunsCsvText = csvText;
                    // derive consistent file key based on station name: runs-<station>.csv
                    const stationKey = this.panels[this.currentPanel].name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$|\s+/g,'');
                    const logicalFileName = `runs-${stationKey}.csv`;
                    this.panels[this.currentPanel].runsFile = logicalFileName;
                    this.savePanelConfiguration();

                    // cache content in localStorage (keyed by panel) if size reasonable
                    const storageKey = `ateMonitorRunsCsv_${this.currentPanel}`;
                    if (csvText.length < 1_500_000) {
                        try {
                            localStorage.setItem(storageKey, csvText);
                        } catch(err) {
                            console.warn('Could not cache CSV (quota):', err);
                        }
                    } else {
                        console.warn('CSV >1.5MB, not cached to avoid quota issues');
                    }

                    // Upload to server so auto-load works for everyone
                    const fd = new FormData();
                    fd.append('file', file, logicalFileName);
                    fetch('/upload_runs', {method:'POST', body:fd})
                        .then(r=>{ if(!r.ok) throw new Error('upload failed');})
                        .then(()=> console.log('CSV uploaded to server'))
                        .catch(err=> console.warn('Upload failed:', err));

                    this.processRunsCsv(csvText);
                } catch (err) {
                    console.error('CSV parse error', err);
                    this.showMessage('Error processing runs CSV', 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    processRunsCsv(csvText) {
        if (!csvText || csvText.trim().length === 0) {
            this.performanceHistory = {};
            this.clearPerformanceColors();
            this.showMessage('Runs CSV is empty or invalid', 'error');
            return;
        }
        // Use PapaParse for robust CSV parsing
        const parsed = Papa.parse(csvText, {header: true, skipEmptyLines: true});
        const data = parsed.data;
        const header = parsed.meta.fields;
        // console.log('[DEBUG] CSV Header:', header);
        const apCols = header.filter(h => /^AP_/i.test(h)).map(h => ({name: h, index: header.indexOf(h)}));
        const missingScr7Idx = header.findIndex(h => h.trim() === 'AP_Missing HS Scr 7');
        // console.log('[DEBUG] Index for AP_Missing HS Scr 7:', missingScr7Idx);
        if(!apCols.length){ this.showMessage('No AP_* columns in CSV', 'error'); return; }

        // Sort data by Start Time ascending
        data.sort((a, b) => new Date(a['Start Time']) - new Date(b['Start Time']));
        const latest = data[data.length - 1];
        // console.log('[DEBUG] Raw row for latest date:', latest);

        // Build history map (keep original order)
        this.performanceHistory = {};
        data.forEach((row, rowIdx) => {
            apCols.forEach(col => {
                let val = parseFloat(row[col.name]);
                if (row[col.name] === '' || row[col.name] === undefined) val = NaN;
                if(!this.performanceHistory[col.name]) this.performanceHistory[col.name] = [];
                this.performanceHistory[col.name].push({
                    time: row['Start Time'],
                    value: val,
                    runId: row['Run ID'],
                    runName: row['Name'],
                    modelVersion: row['ModelVersion']
                });
                // if (col.name === 'AP_Missing HS Scr 7') {
                //     console.log('[DEBUG] Parsed value for AP_Missing HS Scr 7:', val, 'at row', rowIdx, 'time', row['Start Time']);
                // }
            });
        });

        // Apply most-recent values – now supports multiple monitors per RFD
        let ok = 0, under = 0, total = 0;
        const metricNames = apCols.map(c => c.name);

        this.rfds.forEach(rfd => {
            // Helper to extract latest valid value for a metric
            const latestValid = (metric) => {
                const hist = this.performanceHistory[metric] || [];
                for (let i = hist.length - 1; i >= 0; i--) {
                    const v = hist[i].value;
                    if (typeof v === 'number' && !Number.isNaN(v) && v !== -1) {
                        return v;
                    }
                }
                return NaN;
            };

            if (rfd.monitors && rfd.monitors.length) {
                let aggStatus = 'NoData';
                rfd.monitors.forEach(m => {
                    const thr = parseFloat(m.currentThreshold || 0.7);
                    const metric = this.findMetricForMonitor(m.name, metricNames);
                    m.metricName = metric;

                    if (!metric) {
                        m.performanceStatus = 'NoData';
                        return;
                    }

                    const val = latestValid(metric);
                    const hasVal = typeof val === 'number' && !Number.isNaN(val);
                    const status = hasVal ? (val >= thr ? 'OK' : 'Underperform') : 'NoData';

                    m.avgConf = hasVal ? val : undefined;
                    m.performanceStatus = status;
                    m.delta = hasVal ? +(val - thr).toFixed(4) : undefined;

                    // Aggregate counters
                    total++;
                    if (status === 'OK') ok++; else if (status === 'Underperform') under++;

                    // Aggregate RFD-level status
                    if (status === 'Underperform') aggStatus = 'Underperform';
                    else if (status === 'OK' && aggStatus !== 'Underperform') aggStatus = 'OK';
                });

                rfd.performanceStatus = aggStatus;
            } else {
                // Legacy single-monitor RFDs
                const metric = this.findMetricForMonitor(rfd.monitorName, metricNames);
                if (!metric) return;
                const val = latestValid(metric);
                const hasVal = typeof val === 'number' && !Number.isNaN(val);
                const status = hasVal ? (val >= 0.7 ? 'OK' : 'Underperform') : 'NoData';

                rfd.performanceStatus = status;
                rfd.avgConf = hasVal ? val : undefined;
                rfd.threshold = 0.7;
                rfd.delta = hasVal ? +(val - 0.7).toFixed(4) : undefined;

                total++;
                if (status === 'OK') ok++; else if (status === 'Underperform') under++;
            }

            // Save model version for display
            rfd.modelVersion = latest ? latest['ModelVersion'] : undefined;
        });

        // Optionally update UI summary here
        this.updatePerformanceColors();
        this.updatePerformanceSummary(latest ? latest['ModelVersion'] : '', total, ok, under);
        this.showMessage(`Runs CSV imported (latest ${latest ? latest['Start Time'] : ''})`, 'success');
    }

    findMetricForMonitor(monitorName, metricList){
        const clean = s=> s.toLowerCase().replace(/[^a-z0-9]/g,'');
        const target = clean(monitorName);
        
        // Special case for "Missing HS Scr 7"
        if (monitorName.includes('Missing HS Scr 7')) {
            const exactMatch = metricList.find(m => m === 'AP_Missing HS Scr 7');
            if (exactMatch) {
                // console.log('[DEBUG] Special case match for Missing HS Scr 7 ->', exactMatch);
                return exactMatch;
            }
        }
        
        // 1) exact cleaned match
        for (const m of metricList){
            const cleaned = clean(m.replace(/^AP_/i,''));
            if (cleaned === target) {
                // console.log('[DEBUG] Exact metric match for', monitorName, '->', m);
                return m;
            }
        }
        
        // 2) longest partial overlap (more specific metric wins)
        let bestMatch = null;
        let bestLength = 0;
        metricList.forEach(m=>{
            const cleaned = clean(m.replace(/^AP_/i,''));
            if(cleaned.includes(target) || target.includes(cleaned)){
                if(cleaned.length > bestLength){
                    bestLength = cleaned.length;
                    bestMatch = m;
                }
            }
        });
        if (bestMatch) {
            // console.log('[DEBUG] Partial metric match for', monitorName, '->', bestMatch);
        } else {
            // console.log('[DEBUG] No metric match for', monitorName, 'in', metricList);
        }
        return bestMatch;
    }

    openPerformancePage(mapId, monitorIdx = null){
        console.log('openPerformancePage called', {mapId, monitorIdx});
        const rfd = this.rfds.get(mapId);
        if(!rfd){
            this.showMessage('RFD not found', 'error');
            return;
        }

        // Determine which monitor we are visualising
        let monitorName = rfd.monitorName;
        let threshold = typeof rfd.currentThreshold === 'number' ? rfd.currentThreshold : 0.7;
        if(monitorIdx !== null && rfd.monitors && rfd.monitors[monitorIdx]){
            const m = rfd.monitors[monitorIdx];
            console.log('Using monitor index', monitorIdx, m);
            monitorName = m.name || monitorName;
            if(m.currentThreshold !== undefined){
                const thrParsed = parseFloat(m.currentThreshold);
                threshold = !Number.isNaN(thrParsed) ? thrParsed : threshold;
            }
        }
        console.log('Final monitorName for performance', monitorName);

        // Prefer pre-computed metricName from processRunsCsv (avoids fuzzy mismatch issues)
        let metricName = null;
        if(monitorIdx !== null && rfd.monitors && rfd.monitors[monitorIdx]){
            metricName = rfd.monitors[monitorIdx].metricName || null;
        }
        if(!metricName){
            metricName = this.findMetricForMonitor(monitorName, Object.keys(this.performanceHistory));
        }
        console.log('Resolved metricName', metricName);

        const hist = metricName ? this.performanceHistory[metricName] : [];

        if(!hist.length){
            this.showMessage('No performance data', 'warning');
            return;
        }

        // Prepare data for chart
        const sorted = hist.slice().sort((a,b)=> new Date(a.time) - new Date(b.time));
        const labels = sorted.map(h => h.runName || new Date(h.time).toLocaleString());
        const values = sorted.map(h => (typeof h.value==='number' && !Number.isNaN(h.value) && h.value!==-1) ? h.value : null);

        const labelsJson = JSON.stringify(labels);
        const dataJson   = JSON.stringify(values);

        let html = `<html><head><title>Performance - ${monitorName}</title>`;
        html += `<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>`;
        html += `<style>body{font-family:sans-serif;padding:20px;} #chart{max-width:900px;max-height:500px;} </style></head><body>`;
        html += `<h2>${monitorName}</h2><p>Metric: ${metricName || 'N/A'} (green ≥ ${threshold})</p>`;
        html += `<canvas id="chart"></canvas>`;
        html += `<script>
            const ctx = document.getElementById('chart').getContext('2d');
            const labels = ${labelsJson};
            const dataVals = ${dataJson};
            new Chart(ctx,{type:'line', data:{labels:labels, datasets:[{label:'${metricName}', data:dataVals, fill:false, borderColor:'#3498db', tension:0.1, pointRadius:4, pointBackgroundColor:dataVals.map(v=> (v!==null && v>=${threshold})?'#27ae60':'#e74c3c')}]}, options:{responsive:true, plugins:{tooltip:{callbacks:{label:(ctx)=> 'Value: '+ctx.parsed.y}},}, scales:{y:{beginAtZero:true, suggestedMax:1}}}});
        </script>`;
        html += `</body></html>`;
        const win = window.open('','_blank');
        win.document.write(html);
        win.document.close();
    }

    /** Auto fetch default runs.csv in program directory */
    autoLoadRunsCsv(){
        const storageKey = `ateMonitorRunsCsv_${this.currentPanel}`;
        const stored = localStorage.getItem(storageKey);
        if(stored && stored.trim().length > 0){
            this.latestRunsCsvText = stored;
            try{
                this.processRunsCsv(stored);
                return; // done
            }catch(e){ console.warn('Stored CSV parse error',e); }
        }
        // Only clear if both localStorage and fetch fail
        const runsFile = this.panels[this.currentPanel]?.runsFile || 'runs.csv';
        fetch(runsFile)
            .then(res=> res.ok? res.text(): Promise.reject())
            .then(text=> {
                if(text && text.trim().length > 0){
                    this.latestRunsCsvText = text;
                    this.processRunsCsv(text);
                } else {
                    this.clearPerformanceColors();
                }
            })
            .catch(()=> {console.log(`${runsFile} not found – skip auto load`); this.clearPerformanceColors();});
    }

    // Open performance page for all selected monitors
    openMultiPerformancePage(){
        const ids = Array.from(this.multiSelectedIds);
        if(ids.length === 0){ this.showMessage('No monitors selected','warning'); return; }

        // Gather data
        let okCnt=0, underCnt=0;
        const okRows=[]; const underRows=[];

        // Determine latest run info while collecting data
        let latestGlobalTime = 0;
        let latestRunName = '';

        const chartsData=[];
        ids.forEach(id=>{
            const rfd=this.rfds.get(id);
            if(!rfd) return;
            const mList = rfd.monitors && rfd.monitors.length? rfd.monitors: [{name:rfd.monitorName,currentThreshold:0.7}];
            mList.forEach(m=>{
                const metricName=this.findMetricForMonitor(m.name,Object.keys(this.performanceHistory));
                const hist=metricName? this.performanceHistory[metricName]:[];
                const sorted=hist.slice().sort((a,b)=> new Date(a.time)-new Date(b.time));

                if(sorted.length){
                    const last=sorted[sorted.length-1];
                    const tMs=Date.parse(last.time);
                    if(tMs>latestGlobalTime){latestGlobalTime=tMs;latestRunName=last.runName||'';}
                }

                let latestVal=NaN;
                for(let i=sorted.length-1;i>=0;i--){
                    const v=sorted[i].value;
                    if(typeof v==='number' && !Number.isNaN(v) && v!==-1){ latestVal=v; break; }
                }
                const thr=parseFloat(m.currentThreshold||0.7);
                const status = (typeof latestVal==='number' && !Number.isNaN(latestVal)) ? (latestVal>=thr?'OK':'Underperform') : 'NoData';
                if(status==='OK'){okCnt++; okRows.push({name:m.name,val:latestVal});}
                else if(status==='Underperform'){underCnt++; underRows.push({name:m.name,val:latestVal});}

                chartsData.push({
                    title:`${rfd.mapId} – ${m.name}`,
                    metric:metricName,
                    labels: sorted.map(h=> h.runName || new Date(h.time).toLocaleString()),
                    values: sorted.map(h=> h.value),
                    status,latest:latestVal,threshold:thr
                });
            });
        });
        const totalCnt=chartsData.length;
        const pctGood= totalCnt? Math.round((okCnt/totalCnt)*100):0;

        const stationName = this.panels[this.currentPanel]?.name || 'Unknown';
        const latestDateStr = latestGlobalTime? new Date(latestGlobalTime).toLocaleString(): 'N/A';

        const win = window.open('','_blank');
        const doc = win.document;
        doc.open();
        doc.write(`<html><head><title>Performance - Multiple</title><script src="https://cdn.jsdelivr.net/npm/chart.js"></script>`);
        doc.write(`<style>
            body{font-family:sans-serif;padding:20px;}
            .title-page{page-break-after:always;text-align:center;margin-top:100px;}
            .title-page h1{margin-bottom:40px;}
            .chart-grid{display:flex;flex-wrap:wrap;gap:20px;}
            .chart-card{
                flex:1 1 calc(33.333% - 20px);
                background:#f9f9f9;
                padding:12px;
                border:1px solid #ddd;
                border-radius:8px;
                box-sizing:border-box;
                break-inside: avoid;
                page-break-inside: avoid;
                -webkit-column-break-inside: avoid;
                overflow: hidden;
            }
            .chart-card canvas, .chart-card .chartjs-render-monitor {
                width: 100% !important;
                max-width: 100%;
                height: auto !important;
                display: block;
            }
            @media print {
                .chart-grid {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 20px;
                }
                .chart-card {
                    flex: 1 1 48%;
                    max-width: 48%;
                    margin-bottom: 20px;
                    page-break-inside: avoid;
                    break-inside: avoid;
                    overflow: hidden;
                }
                .chart-card canvas, .chart-card .chartjs-render-monitor {
                    width: 100% !important;
                    max-width: 100%;
                    height: auto !important;
                    display: block;
                }
            }
        </style></head><body>`);

        // Title page
        doc.write(`<div class="title-page"><h1>Station Performance Report</h1>`);
        doc.write(`<p><strong>Station:</strong> ${stationName}</p>`);
        doc.write(`<p><strong>Latest Model:</strong> ${latestRunName || 'N/A'}</p>`);
        doc.write(`<p><strong>Date of Model Run:</strong> ${latestDateStr}</p>`);
        doc.write(`</div>`);

        doc.write(`<h2>${chartsData.length} Monitors Performance</h2>`);
        doc.write(`<button onclick=\"window.print()\" style=\"margin:10px 0 20px 0;padding:6px 14px;background:#3498db;color:#fff;border:none;border-radius:4px;cursor:pointer;\">Export Report</button>`);
        doc.write(`<p style="margin-bottom:20px;font-size:14px;"><strong>Total:</strong> ${totalCnt} &nbsp; <span style="color:#27ae60;">OK: ${okCnt}</span> &nbsp; <span style="color:#e74c3c;">Underperform: ${underCnt}</span> &nbsp; % Good: ${pctGood}%</p>`);
        doc.write(`<div class="chart-grid">`);
        chartsData.forEach((d,i)=>{
            const canvasId = `c${i}`;
            doc.write(`<div class="chart-card"><h3>${d.title}</h3><p style="font-size:12px;">Metric: ${d.metric || 'N/A'} (green ≥ 0.7)</p><canvas id="${canvasId}"></canvas></div>`);
        });
        doc.write(`</div>`);
        doc.write(`<script>window.addEventListener('load',()=>{const data=${JSON.stringify(chartsData)};data.forEach((d,i)=>{const ctx=document.getElementById('c'+i).getContext('2d');const colors=d.values.map(v=>v>=0.7?'#27ae60':'#e74c3c');new Chart(ctx,{type:'line',data:{labels:d.labels,datasets:[{label:d.metric,data:d.values,fill:false,borderColor:'#3498db',tension:0.1,pointRadius:4,pointBackgroundColor:colors}]},options:{responsive:true,maintainAspectRatio:true,plugins:{tooltip:{callbacks:{label:(c)=>'Value: '+c.parsed.y}}},scales:{y:{beginAtZero:true,suggestedMax:1}}}});});});<\/script>`);
        doc.write(`<h3>Summary</h3><table class="summary">`);
        doc.write(`<thead><tr><th colspan="2">🟢 OK (${okRows.length})</th></tr></thead><tbody>`);
        okRows.forEach(r=> doc.write(`<tr class="ok-row"><td>${r.name}</td><td>${(typeof r.val==='number'? r.val.toFixed(3):'N/A')}</td></tr>`));
        doc.write(`</tbody>`);
        doc.write(`<thead><tr><th colspan="2">🔴 Underperform (${underRows.length})</th></tr></thead><tbody>`);
        underRows.forEach(r=> doc.write(`<tr class="under-row"><td>${r.name}</td><td>${(typeof r.val==='number'? r.val.toFixed(3):'N/A')}</td></tr>`));
        doc.write(`</tbody></table>`);
        doc.write('</body></html>');
        doc.close();
    }

    clearPerformanceColors(){
        this.rfds.forEach((rfd,id)=>{
            rfd.performanceStatus = undefined;
            const elem = document.querySelector(`[data-rfd-id="${id}"]`);
            if(elem){ elem.style.outline=''; }
        });
        this.performanceLegend && (this.performanceLegend.style.display='none');
        this.performanceSummary && (this.performanceSummary.style.display='none');
    }

    updateSearchField() {
        const mode = this.searchMode.value;
        this.searchFieldContainer.innerHTML = '';
        let el;
        if (mode === 'tcoStatus') {
            el = document.createElement('select');
            el.id = 'searchInput';
            el.innerHTML = `<option value="">Any</option><option value="Implemented">Implemented</option><option value="Pending">Pending</option><option value="Not Requested">Not Requested</option>`;
        } else if (mode === 'type') {
            el = document.createElement('select');
            el.id = 'searchInput';
            el.innerHTML = `<option value="">Any</option><option value="rectangular">Rectangular</option><option value="circular">Circular</option>`;
        } else if (mode === 'creationDate') {
            el = document.createElement('span');
            el.innerHTML = `<input type="date" id="searchInputStart" style="width:120px;"> to <input type="date" id="searchInputEnd" style="width:120px;">`;
        } else if (mode === 'mapId') {
            el = document.createElement('input');
            el.type = 'text';
            el.id = 'searchInput';
            el.placeholder = 'Exact Map ID...';
        } else {
            el = document.createElement('input');
            el.type = 'text';
            el.id = 'searchInput';
            el.placeholder = this.searchInput.placeholder;
        }
        this.searchFieldContainer.appendChild(el);

        // Add scope selector (current vs all stations)
        const scopeSelect = document.createElement('select');
        scopeSelect.id = 'searchScope';
        scopeSelect.style.marginLeft = '8px';
        scopeSelect.innerHTML = `<option value="current" selected>Current Station</option><option value="all">All Stations</option>`;
        this.searchFieldContainer.appendChild(scopeSelect);

        // Enter key handler for new inputs
        const attachEnter = (inputEl)=>{
            if(!inputEl) return;
            inputEl.addEventListener('keypress',e=>{ if(e.key==='Enter'){ this.performSearch(); }});
        };
        if(mode==='creationDate'){
            attachEnter(document.getElementById('searchInputStart'));
            attachEnter(document.getElementById('searchInputEnd'));
        } else {
            attachEnter(document.getElementById('searchInput'));
        }

        // Hide the default searchInput if present
        if (document.getElementById('searchInput') && this.searchInput.parentElement) {
            this.searchInput.style.display = 'none';
        }

        // Ensure we don't keep multiple elements with the same id="searchInput" (Chrome/Edge warning)
        if (this.searchInput && this.searchInput.id === 'searchInput') {
            // Rename the original static input once; future dynamic inputs can safely use #searchInput
            this.searchInput.id = 'searchInputOrig';
        }
    }

    scheduleHideChangeLog(){
        if(this.changeLogHideTimeout){clearTimeout(this.changeLogHideTimeout);} 
        this.changeLogHideTimeout = setTimeout(()=>this.hideChangeLog(),300);
    }

    openMonitorEdit(mapId, idx){
        const rfd=this.rfds.get(mapId);
        if(!rfd||!rfd.monitors||!rfd.monitors[idx]) return;
        const m=rfd.monitors[idx];
        this.isAddingRfd=false;
        this.editingOriginalId=mapId;
        this.editingMonitorIndex=idx;
        // Prefill form
        this.mapIdInput.value=mapId;
        this.monitorNameInput.value=m.name;
        this.creationDateInput.value=m.creationDate||'';
        this.tcoStatusInput.value=m.tcoStatus||'';
        this.commentsInput.value=m.comments||'';
        this.monitorTypeInput.value=m.monitorType||'';
        this.currentThresholdInput.value=m.currentThreshold||0.7;
        // hide rectangle fields
        document.getElementById('shapeColor').closest('.form-group').style.display='none';
        document.getElementById('textColor').closest('.form-group').style.display='none';
        document.getElementById('rfdType').closest('.form-group').style.display='none';
        // Open modal
        this.modalTitle.textContent='Edit Monitor';
        this.showModal();
    }

    async deleteMonitor(mapId,idx){
        const rfd=this.rfds.get(mapId);
        if(!rfd||!rfd.monitors||rfd.monitors.length<=1) return;
        if(!confirm('Delete this monitor?')) return;
        rfd.monitors.splice(idx,1);
        rfd.updatedAt=new Date().toISOString();
        await updateRfdInSupabase(toSupabaseRfd(rfd,this.currentPanel));
        this.rfds.set(mapId,rfd);
        this.updateDetailsPanel();
        this.showMessage('Monitor deleted','success');
    }

    showMonitorDetails(mapId, idx){
        const r=this.rfds.get(mapId);
        if(!r||!r.monitors||!r.monitors[idx]) return;

        // Merge monitor-specific fields into a copy of the RFD object so we can
        // leverage the existing displayRfdDetails method (keeps icons, change-log, etc.)
        const monitor=r.monitors[idx];
        const combined={...r};
        combined.monitorName=monitor.name||monitor.monitorName||r.monitorName;
        combined.tcoStatus=monitor.tcoStatus||r.tcoStatus;
        combined.creationDate=monitor.creationDate||r.creationDate;
        combined.monitorType=monitor.monitorType||r.monitorType;
        combined.currentThreshold=monitor.currentThreshold||r.currentThreshold;
        combined.comments=monitor.comments||r.comments;

        // Re-use the single-item renderer
        this.displayRfdDetails(combined);

        // Replace default action buttons with monitor-aware ones
        const actions=this.rfdDetails.querySelector('.form-actions');
        if(actions){
            actions.innerHTML=`<button class="btn-secondary" onclick="app.openMonitorEdit('${mapId}',${idx})"><i class=\"fas fa-edit\"></i> Edit</button>
            ${r.monitors.length>1?`<button class="btn-secondary" onclick="app.deleteMonitor('${mapId}',${idx})"><i class=\"fas fa-trash\"></i> Delete</button>`:''}
            <button class="btn-secondary" onclick="app.openPerformancePage('${mapId}',${idx})"><i class=\"fas fa-chart-line\"></i> Performance</button>
            <button class="btn-secondary" onclick="app.editRfd('${mapId}')"><i class=\"fas fa-vector-square\"></i> Edit Box</button>`;
        }
    }

}

// Initialize the application
const app = new ATEMonitorMap(); 

// Real-time sync subscription (after app is created)
window.supabase
  .channel('rfds')
  .on('postgres_changes', { event: '*', schema: 'public', table: SUPABASE_TABLE }, payload => {
    if (payload.new && payload.new.panel_id === app.currentPanel) {
      app.loadData();
    } else if (payload.old && payload.old.panel_id === app.currentPanel) {
      app.loadData();
    }
  })
  .subscribe();