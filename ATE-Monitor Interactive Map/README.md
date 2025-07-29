# ATE Monitor Interactive Map

A modern, interactive web application for managing RFDs (Rectangular Feature Designations) on electrical panel images. This application replaces Excel-based tracking with a dynamic, visual interface.

## Features

### 🗺️ Interactive Map
- **Visual RFD Management**: Add, edit, and position RFDs directly on the electrical panel image
- **Drag & Drop**: Move RFDs around the map when unlocked
- **Pan Navigation**: Click and drag on the image to pan around
- **Scroll Zoom**: Use mouse wheel to zoom in/out for detailed inspection
- **Zoom Controls**: Zoom in/out buttons and reset view for detailed inspection
- **Lock/Unlock**: Prevent accidental movement of RFDs

### 📊 RFD Management
- **Complete Data Fields**: Monitor Name (with hyperlinks), Map ID, Creation Date, TCO Status, Comments
- **Visual Types**: Support for both rectangular and circular RFDs
- **Color Customization**: Choose shape colors and text colors for better visibility
- **Form Validation**: Required field validation with user-friendly error messages
- **Real-time Updates**: Instant visual feedback for all changes

### 🔍 Advanced Search
- **Multi-field Search**: Search across all RFD fields (ID, names, status, comments)
- **Real-time Results**: Instant search results with clickable items
- **Visual Navigation**: Click search results to highlight RFDs on the map

### 🎨 Modern UI/UX
- **Responsive Design**: Works on desktop and mobile devices
- **Modern Styling**: Clean, professional interface with smooth animations
- **Accessibility**: Keyboard navigation and screen reader support
- **Status Indicators**: Color-coded TCO status (Implemented, Pending, Not Requested)

## Setup Instructions

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- No server required - runs entirely in the browser

### Installation
1. **Download Files**: Ensure all files are in the same directory:
   - `index.html`
   - `styles.css`
   - `script.js`

2. **Add Your Image**: 
   - The application is now configured to use your real electrical panel image
   - Ensure your image is named `electrical-panel-real.jpg` and placed in the same directory
   - Or update the image source in `index.html` line 25:
     ```html
     <img id="electricalPanel" src="your-image.jpg" alt="Electrical Panel" class="panel-image">
     ```

3. **Open Application**:
   - Double-click `index.html` to open in your browser
   - Or drag `index.html` into your browser window

## Usage Guide

### Adding RFDs
1. Click **"Add RFD"** button
2. Fill in required fields:
   - **RFD ID**: Unique identifier (e.g., L1, L2, DF1)
   - **Monitor Name**: Detailed description (becomes clickable link)
   - **Map ID**: Location identifier
3. Optional fields:
   - **Creation Date**: When the issue was identified
   - **TCO Status**: Implementation status
   - **Comments**: Additional notes
   - **RFD Type**: Rectangular or circular
   - **Shape Color**: Choose border and background color
   - **Text Color**: Choose text color for visibility
4. Click **"Save RFD"**

### Managing RFDs
- **Select RFD**: Click on any RFD on the map to view details
- **Edit RFD**: Click "Edit" button in the sidebar
- **Delete RFD**: Click "Delete" button (with confirmation)
- **Move RFD**: Drag RFDs when map is unlocked
- **Resize RFD**: Drag resize handles when RFD is selected

### Data Management
- **Export Data**: Click "Export" to download all RFD data as JSON file
- **Import Data**: Click "Import" to restore data from a JSON file
- **Reset Data**: Click "Reset Data" to clear all data and restore sample data
- **Auto-save**: All changes are automatically saved to browser storage

### Search Functionality
1. Enter search terms in the search box
2. Press Enter or click the search icon
3. Click on search results to navigate to that RFD
4. Results show RFD ID, ATE Name, Monitor Name, Map ID, and Status

### Map Controls
- **Lock/Unlock**: Toggle RFD movement prevention
- **Pan**: Click and drag on the image to move around
- **Scroll Zoom**: Use mouse wheel to zoom in/out
- **Zoom In/Out**: Use buttons to adjust view magnification
- **Reset Zoom**: Return to original view and position

## Data Structure

Each RFD contains the following fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| RFD ID | Text | Yes | Unique identifier |
| Monitor Name | Text | Yes | Detailed description (hyperlink) |
| Map ID | Text | Yes | Location identifier |
| Creation Date | Date | No | Issue identification date |
| TCO Status | Select | No | Implementation status |
| Comments | Text | No | Additional notes |
| Type | Select | No | Rectangular or circular |
| Shape Color | Color | No | Color for RFD shape border and background |
| Text Color | Color | No | Color for RFD ID text |

## Sample Data

The application includes sample RFDs based on your actual electrical panel components with color coding:
- **L1**: Telit Communication Module Issue (Blue)
- **L2**: Solar Edge Chip Defect (Red)
- **L3**: BM Power Module Stack Issue (Green)
- **L4**: Hyundai Component Defect (Orange)
- **L5**: Copper Busbar Connection Issue (Purple)
- **L6**: Ferrite Core Inductor Problem (Dark Orange)
- **L7**: MOD 2 LED Indicator Issue (Teal)
- **L8**: AC Output Terminal Block Problem (Dark Red)
- **L9**: Cable Gland Seal Defect (Dark Gray)
- **L10**: Yellow Wire Bundle Issue (Yellow)

## Browser Compatibility

- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Safari 13+
- ✅ Edge 80+

## Keyboard Shortcuts

- **Escape**: Close modals
- **Enter**: Submit search
- **Tab**: Navigate form fields
- **Shift + 1**: Reset view to full screen mode
- **Shift + 2**: Zoom in at mouse cursor position
- **Mouse Wheel**: Zoom in/out
- **Click + Drag**: Pan around the image

## Customization

### Styling
Edit `styles.css` to customize:
- Colors and themes
- Layout and spacing
- Animations and transitions

### Functionality
Modify `script.js` to add:
- Additional data fields
- Custom validation rules
- Export/import functionality
- Integration with external systems

### Sample Data
Update the `loadSampleData()` function in `script.js` to load your actual data.

## Troubleshooting

### Image Not Loading
- Ensure the image file exists in the same directory
- Check file permissions
- Verify image format (JPG, PNG, etc.)

### RFDs Not Appearing
- Check browser console for JavaScript errors
- Verify all files are in the same directory
- Ensure JavaScript is enabled

### Search Not Working
- Clear browser cache
- Check for typos in search terms
- Verify RFD data is loaded

## Data Persistence & Backup

### Automatic Saving
- **localStorage**: All RFD data is automatically saved to your browser's localStorage
- **Real-time Updates**: Changes are saved immediately when you add, edit, move, or delete RFDs
- **Session Persistence**: Data persists between browser sessions and page refreshes
- **Visual Feedback**: Brief "Saved" indicator appears when data is saved

### Data Management
- **Export Data**: Download all RFD data as a JSON file for backup
- **Import Data**: Restore data from a previously exported JSON file
- **Reset Data**: Clear all data and restore sample data
- **Cross-browser**: Export/import allows data transfer between different browsers

### Backup Features
- **Automatic Backup**: Data is saved locally in your browser
- **Manual Export**: Create backup files with timestamps
- **Data Recovery**: Import previous exports to restore data
- **Version Control**: Export files include version and date information

## Future Enhancements

- **Cloud Storage**: Save to cloud services (Google Drive, Dropbox)
- **Database Integration**: Connect to external databases
- **Image Upload**: Upload new panel images
- **User Authentication**: Multi-user support
- **Version Control**: Track changes and history
- **API Integration**: Connect to external systems

## Support

For issues or feature requests, please check:
1. Browser console for error messages
2. File structure and permissions
3. JavaScript compatibility

---

**Note**: This application runs entirely in the browser. No server setup or internet connection required for basic functionality. 