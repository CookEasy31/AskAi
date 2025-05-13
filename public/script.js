// Frontend JavaScript logic
document.addEventListener('DOMContentLoaded', () => {
    // Form and input elements
    const form = document.getElementById('input-form');
    const fileInput = document.getElementById('file-input');
    const imageInput = document.getElementById('image-input');
    const fileInfo = document.getElementById('file-info');
    const fileName = document.getElementById('file-name');
    const removeFileBtn = document.getElementById('remove-file');
    const topicInput = document.getElementById('topic-input');
    const contentTextarea = document.getElementById('content-textarea');
    const coreInstruction = document.getElementById('core-instruction');
    
    // Output elements
    const outputFrame = document.getElementById('output-frame');
    const emptyState = document.getElementById('empty-state');
    const downloadButton = document.getElementById('download-html-button');
    const resultActions = document.getElementById('result-actions');
    const loadingOverlay = document.getElementById('loading-overlay');
    const errorMessageDiv = document.getElementById('error-message');
    const generateButton = document.getElementById('generate-button');
    const progressBar = document.getElementById('progress-bar');
    const timeCounter = document.getElementById('time-counter');

    // Format and length options
    const formatOptions = document.querySelectorAll('.format-option');
    const lengthOptions = document.querySelectorAll('.length-option');
    const creativitySlider = document.getElementById('creativity-slider');
    const creativityLabel = document.querySelector('.label-balanced');
    
    // Store the generated HTML for download
    let generatedHtml = null;

    // Enable generate button initially if needed
    checkFormValidity();

    // Handle format option selection
    formatOptions.forEach(option => {
        const radio = option.querySelector('input[type="radio"]');
        
        option.addEventListener('click', () => {
            // Uncheck all radios
            formatOptions.forEach(o => {
                o.classList.remove('active');
            });
            
            // Check this radio
            radio.checked = true;
            option.classList.add('active');
        });
    });
    
    // Handle length option selection
    const lengthDescription = document.getElementById('length-description');
    
    lengthOptions.forEach(option => {
        const radio = option.querySelector('input[type="radio"]');
        
        option.addEventListener('click', () => {
            // Uncheck all radios
            lengthOptions.forEach(o => {
                o.classList.remove('active');
            });
            
            // Check this radio
            radio.checked = true;
            option.classList.add('active');
            
            // Update the word count description based on selected length
            updateLengthDescription(radio.value);
        });
    });
    
    // Handle creativity slider
    creativitySlider.addEventListener('input', updateCreativityLabel);
    
    function updateCreativityLabel() {
        const value = parseInt(creativitySlider.value);
        let label = '';
        
        switch(value) {
            case 1: label = 'Conservative'; break;
            case 2: label = 'Mild'; break;
            case 3: label = 'Balanced'; break;
            case 4: label = 'Enhanced'; break;
            case 5: label = 'Creative'; break;
            case 6: label = 'Maximum'; break;
        }
        
        creativityLabel.textContent = label;
    }

    // File Upload Handling
    fileInput.addEventListener('change', () => {
        handleFileSelect(fileInput);
        checkFormValidity();
    });
    
    imageInput.addEventListener('change', () => {
        handleFileSelect(imageInput);
        checkFormValidity();
    });
    
    function handleFileSelect(inputElement) {
        if (inputElement.files.length > 0) {
            const file = inputElement.files[0];
            
            // Check file size (client-side validation)
            const maxSizeMB = 100;
            const maxSizeBytes = maxSizeMB * 1024 * 1024;
            
            if (file.size > maxSizeBytes) {
                showError(`Die Datei ist zu groß (${(file.size / 1024 / 1024).toFixed(2)} MB). Maximale Größe: ${maxSizeMB} MB.`);
                inputElement.value = '';
                return;
            }
            
            // Warn about large PDFs (>20MB)
            if (file.size > 20 * 1024 * 1024 && file.type === 'application/pdf') {
                showWarning(`Große PDF-Datei (${(file.size / 1024 / 1024).toFixed(2)} MB). Die Verarbeitung kann länger dauern und möglicherweise fehlschlagen.`);
            }
            
            // Show file info
            fileName.textContent = file.name;
            fileInfo.style.display = 'flex';
        } else {
            resetFileUpload();
        }
    }
    
    removeFileBtn.addEventListener('click', () => {
        fileInput.value = '';
        imageInput.value = '';
        resetFileUpload();
        checkFormValidity();
    });
    
    function resetFileUpload() {
        fileInfo.style.display = 'none';
    }

    // Text area input validation
    contentTextarea.addEventListener('input', checkFormValidity);
    
    // Function to check if the form has valid input
    function checkFormValidity() {
        const hasFile = fileInput.files.length > 0 || imageInput.files.length > 0;
        const hasContent = contentTextarea.value.trim().length >= 10;
        
        // Enable button if either file is uploaded or content is entered
        generateButton.disabled = !(hasFile || hasContent);
        
        console.log("Form validity checked: hasFile=", hasFile, "hasContent=", hasContent);
    }

    // Form Submission
    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        // Prepare form data
        const formData = new FormData(form);
        
        // Show loading overlay and start animations
        loadingOverlay.style.display = 'flex';
        errorMessageDiv.style.display = 'none';
        generateButton.disabled = true;
        downloadButton.disabled = true;
        resultActions.style.display = 'none';
        outputFrame.style.display = 'none';
        emptyState.style.display = 'block';
        
        // Start morphing icon animation
        startMorphingAnimation();

        try {
            console.log('Sending request to backend...');
            
            const response = await fetch('/generate', {
                method: 'POST',
                body: formData // Using FormData to handle file uploads
            });

            if (!response.ok) {
                const errorData = await response.json()
                    .catch(() => ({ error: 'Unbekannter Fehler vom Server', details: response.statusText }));
                throw new Error(`Serverfehler: ${errorData.error || response.statusText}. Details: ${errorData.details || 'Keine'}`);
            }

            const result = await response.json();
            console.log('Received response from backend.');

            if (result.generatedHtml) {
                generatedHtml = result.generatedHtml;
                
                // Display in iframe
                emptyState.style.display = 'none';
                outputFrame.style.display = 'block';
                outputFrame.contentWindow.document.open();
                outputFrame.contentWindow.document.write(generatedHtml);
                outputFrame.contentWindow.document.close();
                
                // Enable download button
                downloadButton.disabled = false;
                resultActions.style.display = 'flex';
            } else {
                showError('Kein HTML-Inhalt vom Server erhalten.');
            }
        } catch (error) {
            console.error('Fehler bei der Generierung:', error);
            showError(`Ein Fehler ist aufgetreten: ${error.message}`);
            generatedHtml = null;
        } finally {
            stopMorphingAnimation();
            loadingOverlay.style.display = 'none';
            generateButton.disabled = false;
            checkFormValidity();
        }
    });

    // Download HTML functionality
    downloadButton.addEventListener('click', () => {
        if (!generatedHtml) return;
        
        const blob = new Blob([generatedHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${topicInput.value.trim() || 'generiert'}.html`;
        a.click();
        
        URL.revokeObjectURL(url);
    });

    // Theme toggle functionality
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const icon = themeToggleBtn.querySelector('i');
        if (document.body.classList.contains('dark-mode')) {
            icon.className = 'fas fa-sun';
        } else {
            icon.className = 'fas fa-moon';
        }
    });

    // Language toggle functionality
    const langToggleBtn = document.getElementById('lang-toggle-btn');
    langToggleBtn.addEventListener('click', () => {
        if (document.body.classList.contains('de')) {
            document.body.classList.remove('de');
            document.body.classList.add('en');
        } else {
            document.body.classList.remove('en');
            document.body.classList.add('de');
        }
        
        // Update language-specific placeholders
        updatePlaceholders();
    });
    
    // Update placeholders based on language
    function updatePlaceholders() {
        const isGerman = document.body.classList.contains('de');
        
        const contentTextarea = document.getElementById('content-textarea');
        if (isGerman) {
            contentTextarea.placeholder = 'Falls keine Datei/Bild hochgeladen wird, fügen Sie hier Text ein (mind. 10 Zeichen). Oder ergänzen Sie Hinweise zu Ihrem Upload.';
        } else {
            contentTextarea.placeholder = 'If not uploading a file/image, paste text here (min 10 chars). Or, add notes for your uploaded content.';
        }
    }
    
    // Initialize placeholders
    updatePlaceholders();
    
    // Collapsible prompt editor
    const promptEditorToggle = document.getElementById('prompt-editor-toggle');
    const promptEditorPanel = document.getElementById('prompt-editor-panel');
    const savePromptBtn = document.getElementById('save-prompt');
    const resetPromptBtn = document.getElementById('reset-prompt');
    const coreInstructionField = document.getElementById('core-instruction');
    
    // Default prompt value
    const defaultPrompt = coreInstructionField.value;
    
    promptEditorToggle.addEventListener('click', () => {
        promptEditorToggle.classList.toggle('active');
        if (promptEditorPanel.style.display === 'none' || !promptEditorPanel.style.display) {
            promptEditorPanel.style.display = 'block';
            promptEditorPanel.classList.add('active');
        } else {
            promptEditorPanel.style.display = 'none';
            promptEditorPanel.classList.remove('active');
        }
    });
    
    // Save prompt button
    savePromptBtn.addEventListener('click', () => {
        // Just close the panel - the textarea value is already bound to the form
        promptEditorPanel.style.display = 'none';
        promptEditorToggle.classList.remove('active');
        promptEditorPanel.classList.remove('active');
        showInfo(document.body.classList.contains('de') ? 'Anweisungen gespeichert' : 'Instructions saved');
    });
    
    // Reset prompt button
    resetPromptBtn.addEventListener('click', () => {
        coreInstructionField.value = defaultPrompt;
        showInfo(document.body.classList.contains('de') ? 'Anweisungen zurückgesetzt' : 'Instructions reset');
    });
    
    // Display error message
    function showError(message) {
        errorMessageDiv.textContent = message;
        errorMessageDiv.style.display = 'block';
        // Scroll to error message
        errorMessageDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Display warning message
    function showWarning(message) {
        // Create warning element if it doesn't exist
        let warningEl = document.getElementById('warning-message');
        if (!warningEl) {
            warningEl = document.createElement('div');
            warningEl.id = 'warning-message';
            warningEl.className = 'warning';
            const inputCard = document.querySelector('.input-card');
            inputCard.insertBefore(warningEl, inputCard.firstChild.nextSibling);
        }
        
        warningEl.textContent = message;
        warningEl.style.display = 'block';
        
        // Scroll to warning message
        warningEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Auto-hide after 8 seconds
        setTimeout(() => {
            warningEl.style.display = 'none';
        }, 8000);
    }

    // Display info message
    function showInfo(message) {
        // Create info element if it doesn't exist
        let infoEl = document.getElementById('info-message');
        if (!infoEl) {
            infoEl = document.createElement('div');
            infoEl.id = 'info-message';
            infoEl.className = 'info';
            const inputCard = document.querySelector('.input-card');
            inputCard.insertBefore(infoEl, inputCard.firstChild.nextSibling);
        }
        
        infoEl.textContent = message;
        infoEl.style.display = 'block';
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            infoEl.style.display = 'none';
        }, 3000);
    }

    // Initialize length description
    function updateLengthDescription(lengthValue) {
        switch(lengthValue) {
            case 'Brief':
                lengthDescription.textContent = '~150-200 Wörter';
                break;
            case 'Standard':
                lengthDescription.textContent = '~400-600 Wörter';
                break;
            case 'Detailed':
                lengthDescription.textContent = '~800-1200 Wörter';
                break;
            default:
                lengthDescription.textContent = '~400-600 Wörter';
        }
    }
    
    // Initialize with default length
    const initialLength = document.querySelector('input[name="length"]:checked').value;
    updateLengthDescription(initialLength);

    // Morphing icon animation
    let morphingInterval;
    const morphIcons = document.querySelectorAll('.morph-icon');
    
    function startMorphingAnimation() {
        let currentIconIndex = 0;
        
        // Show first icon
        morphIcons[currentIconIndex].classList.add('active');
        
        morphingInterval = setInterval(() => {
            // Fade out current icon
            morphIcons[currentIconIndex].classList.remove('active');
            morphIcons[currentIconIndex].classList.add('fade-out');
            
            // Calculate next icon index
            currentIconIndex = (currentIconIndex + 1) % morphIcons.length;
            
            // Show next icon
            setTimeout(() => {
                // Remove fade-out from all icons
                morphIcons.forEach(icon => icon.classList.remove('fade-out'));
                
                // Activate new icon
                morphIcons[currentIconIndex].classList.add('active');
            }, 400);
        }, 2000);
    }
    
    function stopMorphingAnimation() {
        clearInterval(morphingInterval);
        morphIcons.forEach(icon => {
            icon.classList.remove('active');
            icon.classList.remove('fade-out');
        });
    }
    
    // Model toggle fix
    const modelToggle = document.querySelector('.model-toggle');
    const modelGemini2 = document.getElementById('model-gemini-2');
    const modelGemini25 = document.getElementById('model-gemini-2-5');
    
    modelGemini2.addEventListener('change', function() {
        if (this.checked) {
            modelToggle.querySelector('.slider').style.left = '4px';
        }
    });
    
    modelGemini25.addEventListener('change', function() {
        if (this.checked) {
            modelToggle.querySelector('.slider').style.left = 'calc(50% + 0px)';
        }
    });
}); 