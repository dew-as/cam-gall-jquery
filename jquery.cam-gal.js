(function($) {
    'use strict';

    // Default settings
    const defaults = {
        defaultFacingMode: 'environment'
    };

    // Plugin constructor
    function CamGal(element, options) {
        
        this.$element = $(element);
        this.settings = $.extend({}, defaults, options);
        this.init();
    }

    // Plugin methods
    CamGal.prototype = {
        // Initialize the plugin
        init: function() {
            this.name = this.$element.data('cg-name') || 'image';
            this.multiple = this.$element.data('cg-multiple') || false;
            this.framePath = this.$element.data('cg-frame') || '';
            this.preview = this.$element.data('cg-preview') !== false;
            this.images = [];
            this.inputsContainer = $(`<div class="cam-gal-inputs"></div>`);
            this.$element.after(this.inputsContainer);
            
            // Load existing values if any
            this.loadExistingValues();
            
            // Bind events
            this.bindEvents();
        },

        bindEvents: function() {
            // Bind click event
            this.$element.on('click', this.openModal.bind(this));
        },

        openModal: function() {
            console.log(this);

            // Create modal if doesn't exist
            if(!$('#cam-gal-modal').length) {
                this.createModal();
            }
            
            // Store current instance
            $('#cam-gal-modal').data('current-instance', this);
            
            // Show preview or options
            if(this.preview && this.images.length > 0) {
                this.showPreview();
            } else {
                this.showOptions();
            }
            
            // Show modal
            $('#cam-gal-modal').fadeIn();
            $('body').css('overflow', 'hidden');
        },

        createModal: function() {
            // Create modal structure
            const modalHTML = `
            <div id="cam-gal-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:2000;">
                <div style="position:relative; max-width:500px; margin:50px auto; background:#fff; border-radius:8px; padding:20px;">
                    <!-- Options View -->
                    <div id="cam-gal-options" style="display:none;">
                        <h4 class="text-center mb-4">Select Source</h4>
                        <div class="d-flex justify-content-center gap-3">
                            <button class="btn btn-primary cam-gal-option" data-type="camera">
                                <i class="bi bi-camera"></i> Camera
                            </button>
                            <button class="btn btn-secondary cam-gal-option" data-type="gallery">
                                <i class="bi bi-images"></i> Gallery
                            </button>
                        </div>
                    </div>
                    
                    <!-- Preview View -->
                    <div id="cam-gal-preview" style="display:none;">
                        <h4 class="text-center mb-3">Preview</h4>
                        <div class="preview-images d-flex flex-wrap gap-2 mb-3"></div>
                        <div class="d-flex justify-content-center gap-2">
                            <button class="btn btn-secondary cam-gal-back">Back</button>
                            <button class="btn btn-primary cam-gal-add">Add More</button>
                        </div>
                    </div>
                    
                    <!-- Camera View -->
                    <div id="cam-gal-camera" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:#000;">
                        <div class="camera-top-bar" style="position:absolute; top:0; left:0; width:100%; padding:15px; display:flex; justify-content:space-between; z-index:1001;">
                            <button class="btn btn-sm btn-light cam-gal-close-camera">
                                <i class="bi bi-arrow-left"></i>
                            </button>
                            <button class="btn btn-sm btn-light cam-gal-switch-camera">
                                <i class="bi bi-camera-reverse"></i> 
                            </button>
                        </div>
                        
                        <div class="camera-video-container" style="position:absolute; top:0; left:0; width:100%; height:100%;">
                            <video class="cam-gal-video" autoplay playsinline style="width:100%; height:100%; object-fit:cover;"></video>
                            <div class="frame-overlay" style="position:absolute; top:0; left:0; width:100%; height:100%; background-size:contain; background-position:center; background-repeat:no-repeat; pointer-events:none; z-index:2; opacity:0; transition:opacity 0.3s;"></div>
                        </div>
                        
                        <div class="camera-controls" style="position:fixed; bottom:30px; left:0; width:100%; display:flex; justify-content:center; z-index:1002;">
                            <div class="capture-btn" style="width:70px; height:70px; border-radius:50%; background:rgba(255,255,255,0.3); border:4px solid white; display:flex; align-items:center; justify-content:center; cursor:pointer;">
                                <i class="bi bi-circle-fill" style="font-size:30px; color:white;"></i>
                            </div>
                        </div>
                    </div>
                    
                    <div class="text-center mt-3">
                        <button class="btn btn-outline-secondary cam-gal-close">Close</button>
                    </div>
                </div>
            </div>`;

            // Add style for front camera mirroring if not present
    if (!$('#cam-gal-front-camera-style').length) {
        const css = `
            #cam-gal-modal .front-camera {
                transform: scaleX(-1);
            }
        `;
        $('head').append($('<style>', {
            id: 'cam-gal-front-camera-style',
            text: css
        }));
    }
            
            $('body').append(modalHTML);
            
            // Add event listeners
            this.addModalListeners();
        },

        addModalListeners: function() {
            const self = this;
            
            // Option selection
            $(document).on('click', '.cam-gal-option', function() {
                const type = $(this).data('type');
                const instance = $('#cam-gal-modal').data('current-instance');
                
                if(type === 'camera') {
                    instance.showCamera();
                } else {
                    instance.openGallery();
                }
            });
            
            // Back to options
            $(document).on('click', '.cam-gal-back', function() {
                $('#cam-gal-preview').hide();
                $('#cam-gal-options').show();
            });
            
            // Add more images
            $(document).on('click', '.cam-gal-add', function() {
                const instance = $('#cam-gal-modal').data('current-instance');
                $('#cam-gal-preview').hide();
                $('#cam-gal-options').show();
            });
            
            // Close modal
            $(document).on('click', '.cam-gal-close', function() {
                $('#cam-gal-modal').fadeOut();
                $('body').css('overflow', '');
            });
            
            // Camera controls
            $(document).on('click', '.cam-gal-close-camera', function() {
                const instance = $('#cam-gal-modal').data('current-instance');
                instance.stopCamera();
                $('#cam-gal-camera').hide();
                $('#cam-gal-options').show();
            });
            
            $(document).on('click', '.cam-gal-switch-camera', function() {
                const instance = $('#cam-gal-modal').data('current-instance');
                instance.switchCamera();
            });
            
            $(document).on('click', '.capture-btn', function() {
                const instance = $('#cam-gal-modal').data('current-instance');
                instance.captureImage();
            });
        },

        showOptions: function() {
            $('#cam-gal-options').show();
            $('#cam-gal-preview').hide();
            $('#cam-gal-camera').hide();
        },

        showPreview: function() {
            const $preview = $('#cam-gal-preview .preview-images');
            $preview.empty();
            
            // Show loading indicator
            const $loading = $('<div class="d-flex justify-content-center align-items-center" style="width:100%; height:100px;">' +
                            '<div class="spinner-border text-primary" role="status">' +
                            '<span class="visually-hidden">Loading...</span></div></div>');
            $preview.append($loading);
            
            // Process images with a small delay to allow UI to update
            setTimeout(() => {
                $loading.remove();
                
                this.images.forEach((img, index) => {
                    $preview.append(`
                        <div class="preview-item position-relative" style="width:100px; height:100px; cursor: pointer;">
                            <img src="${img}" class="img-thumbnail preview-image" data-index="${index}" style="width:100%; height:100%; object-fit:cover;">
                            <button class="btn btn-danger btn-sm remove-image" data-index="${index}" style="position:absolute; top:0; right:0; padding:0.25rem;">
                                <i class="bi bi-x"></i>
                            </button>
                        </div>
                    `);
                });
                
                // Add event for remove buttons
                $preview.find('.remove-image').on('click', (e) => {
                    e.stopPropagation(); // Prevent triggering the preview
                    const index = $(e.currentTarget).data('index');
                    this.removeImage(index);
                });
                
                // Add click event for preview images
                $preview.find('.preview-item').on('click', (e) => {
                    if (!$(e.target).hasClass('remove-image')) {
                        const index = $(e.currentTarget).find('.preview-image').data('index');
                        this.showFullscreenPreview(this.images[index]);
                    }
                });
                
                // Toggle "Add More" button
                $('.cam-gal-add').toggle(this.multiple);
                
                $('#cam-gal-preview').show();
                $('#cam-gal-options').hide();
                $('#cam-gal-camera').hide();
            }, 100); // Small delay to ensure UI updates
        },
        
        showFullscreenPreview: function(imageSrc) {
            // Create fullscreen preview if it doesn't exist
            let $fullscreenPreview = $('#cam-gal-fullscreen-preview');
            
            if ($fullscreenPreview.length === 0) {
                $('body').append(`
                    <div id="cam-gal-fullscreen-preview" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:3000; display:flex; justify-content:center; align-items:center; flex-direction:column;">
                        <button class="btn btn-light" style="position:absolute; top:20px; left:20px;">
                            <i class="bi bi-arrow-left"></i> Back
                        </button>
                        <img src="${imageSrc}" style="max-width:90%; max-height:80vh; object-fit:contain;">
                    </div>
                `);
                $fullscreenPreview = $('#cam-gal-fullscreen-preview');
                
                // Handle back button click
                $fullscreenPreview.find('button').on('click', () => {
                    $fullscreenPreview.remove();
                });
                
                // Close on escape key
                $(document).on('keyup.fullscreenPreview', (e) => {
                    if (e.key === 'Escape') {
                        $fullscreenPreview.remove();
                        $(document).off('keyup.fullscreenPreview');
                    }
                });
                
                // Close on backdrop click
                $fullscreenPreview.on('click', (e) => {
                    if (e.target === $fullscreenPreview[0]) {
                        $fullscreenPreview.remove();
                        $(document).off('keyup.fullscreenPreview');
                    }
                });
            } else {
                $fullscreenPreview.find('img').attr('src', imageSrc);
            }
            
            $fullscreenPreview.show();
        },

        removeImage: function(index) {
            this.images.splice(index, 1);
            this.updateInput();
            this.showPreview();
        },

        showCamera: function() {
            $('#cam-gal-options').hide();
            $('#cam-gal-preview').hide();
            $('#cam-gal-camera').show();
            
            // Set frame if path is provided
            const $frame = $('.frame-overlay');
            $frame.css('opacity', 0);
            
            if(this.framePath) {
                $frame.css('background-image', `url(${this.framePath})`);
                $frame.css('opacity', 1);
            }
            
            this.startCamera();
        },

        startCamera: function() {
            const self = this;
            const $video = $('.cam-gal-video');
            
            // Stop any existing stream
            this.stopCamera();
            
            // Constraints
            const constraints = {
                video: {
                    facingMode: this.facingMode || 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            };
            
            // Request camera
            navigator.mediaDevices.getUserMedia(constraints)
                .then(function(stream) {
                    self.stream = stream;
                    $video[0].srcObject = stream;
                    
                    // Set front camera mirror effect
                    $video.toggleClass('front-camera', 
                        constraints.video.facingMode === 'user');
                    
                    return new Promise((resolve) => {
                        $video[0].onloadedmetadata = () => {
                            $video[0].play().then(resolve);
                        };
                    });
                })
                .catch(function(error) {
                    console.error('Camera error:', error);
                    alert('Could not access the camera. Please check permissions.');
                    self.showOptions();
                });
        },

        stopCamera: function() {
            if(this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
                this.stream = null;
            }
        },

        switchCamera: function() {
            this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
            this.stopCamera();
            this.startCamera();
        },

        captureImage: function() {
            const $video = $('.cam-gal-video')[0];
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set canvas dimensions
            canvas.width = $video.videoWidth;
            canvas.height = $video.videoHeight;
            
            // Draw video frame to canvas
            ctx.drawImage($video, 0, 0, canvas.width, canvas.height);
            
            // Convert to base64 with maximum quality
            const imageData = canvas.toDataURL('image/jpeg', 1.0);
            
            // Add to images
            if(this.multiple) {
                this.images.push(imageData);
            } else {
                this.images = [imageData];
            }
            
            // Update input
            this.updateInput();
            
            // Show preview or close camera
            if(this.preview) {
                this.stopCamera();
                this.showPreview();
            } else if(!this.multiple) {
                this.stopCamera();
                $('#cam-gal-camera').hide();
                $('#cam-gal-modal').fadeOut();
                $('body').css('overflow', '');
            }
        },

        openGallery: function() {
            // Create temporary file input with explicit MIME types including HEIC/HEIF
            const $fileInput = $('<input type="file" accept="image/*,.heic,.heif,image/heic,image/heif" style="display:none;">');
            
            if(this.multiple) {
                $fileInput.attr('multiple', true);
            }
            
            $('body').append($fileInput);
            
            $fileInput.on('change', async (e) => {
                const files = e.target.files;
                if(!files.length) return;
                
                // Show loading overlay
                const $loadingOverlay = $(`
                    <div class="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" 
                         style="z-index: 3000;">
                        <div class="text-center text-white">
                            <div class="spinner-border mb-2" role="status">
                                <span class="visually-hidden">Loading...</span>
                            </div>
                            <p>Processing image...</p>
                        </div>
                    </div>
                `);
                $('body').append($loadingOverlay);
                
                try {
                    let file = files[0];
                    let imageData;

                    // Check if file is HEIC/HEIF
                    const isHeic = file.name.toLowerCase().endsWith('.heic') || 
                                 file.name.toLowerCase().endsWith('.heif') ||
                                 file.type === 'image/heic' || 
                                 file.type === 'image/heif';

                    if (isHeic && typeof heic2any !== 'undefined') {
                        // Convert HEIC to JPEG
                        $loadingOverlay.find('p').text('Converting HEIC to JPEG...');
                        const jpegBlob = await heic2any({
                            blob: file,
                            toType: 'image/jpeg',
                            quality: 1.0
                        });
                        
                        // Convert blob to base64
                        $loadingOverlay.find('p').text('Processing image...');
                        imageData = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onload = (e) => resolve(e.target.result);
                            reader.readAsDataURL(jpegBlob);
                        });
                    } else {
                        // For non-HEIC files, read as usual
                        imageData = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onload = (e) => resolve(e.target.result);
                            reader.readAsDataURL(file);
                        });
                    }

                    // Add to images
                    if(this.multiple) {
                        this.images.push(imageData);
                    } else {
                        this.images = [imageData];
                    }
                    
                    // Update input
                    this.updateInput();
                    
                    // Show preview or close modal
                    if(this.preview) {
                        this.showPreview();
                    } else {
                        $('#cam-gal-modal').fadeOut();
                        $('body').css('overflow', '');
                    }
                } catch (error) {
                    console.error('Error processing image:', error);
                    alert('Error processing the image. Please try another image.');
                } finally {
                    // Remove loading overlay and temporary input
                    $loadingOverlay.remove();
                    $fileInput.remove();
                }
            });
            
            // Trigger file selection
            $fileInput.click();
        },

        loadExistingValues: function() {
            // Check for existing inputs with the same name
            const existingInputs = $(`input[type="hidden"][name^="${this.name}"]`);
            
            if (existingInputs.length > 0) {
                // If we found existing inputs, load their values
                this.images = existingInputs.map(function() {
                    return $(this).val();
                }).get().filter(Boolean);
                
                // Remove the old inputs as we'll recreate them
                existingInputs.not(this.inputsContainer.find('input')).remove();
            } else {
                // Fallback to checking the old single input value
                const oldInput = $(`input[type="hidden"][name="${this.name}"]`);
                if (oldInput.length) {
                    const value = oldInput.val();
                    if (value) {
                        try {
                            this.images = JSON.parse(value);
                            if (!Array.isArray(this.images)) {
                                this.images = [this.images];
                            }
                        } catch (e) {
                            this.images = [value];
                        }
                        oldInput.remove();
                    }
                }
            }
            
            // Filter out any empty values
            this.images = this.images.filter(img => img);
            
            // Update the inputs to match the loaded values
            if (this.images.length > 0) {
                this.updateInput();
            }
        },

        updateInput: function() {
            // Clear existing inputs
            this.inputsContainer.empty();
            
            if (this.multiple) {
                // For multiple images, create an input for each image
                this.images.forEach((image, index) => {
                    const input = $(`<input type="hidden" name="${this.name}[]" value="${image}">`);
                    this.inputsContainer.append(input);
                });
            } else {
                // For single image, create a single input
                if (this.images.length > 0) {
                    const input = $(`<input type="hidden" name="${this.name}" value="${this.images[0]}">`);
                    this.inputsContainer.append(input);
                }
            }
            
            // Trigger change event on the container for any external listeners
            this.inputsContainer.trigger('change');
        },

        destroy: function() {
            this.stopCamera();
            this.$element.off('click');
            $('#cam-gal-modal').remove();
        }
    };

    // jQuery plugin definition
    $.fn.camGal = function(options) {
        return this.each(function() {
            if(!$.data(this, 'camGal')) {
                $.data(this, 'camGal', new CamGal(this, options));
            }
        });
    };

})(jQuery);