(function($) {
    'use strict';

    // Default settings
    const defaults = {
        framePath: 'frames/',
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
        init: function() {
            // Get attributes
            this.name = this.$element.data('cg-name');
            this.multiple = this.$element.data('cg-multiple') === 'true' || this.$element.data('cg-multiple') === true;
            this.frame = this.$element.data('cg-frame') === 'true' || this.$element.data('cg-frame') === true;
            this.preview = this.$element.data('cg-preview') === 'true' || this.$element.data('cg-preview') === true;
            
            // Find corresponding input
            this.$input = $(`input[name="${this.name}"]`);
            
            // Initialize images array
            this.images = [];
            if(this.$input.val()) {
                try {
                    this.images = this.multiple ? JSON.parse(this.$input.val()) : [this.$input.val()];
                } catch(e) {
                    this.images = [];
                }
            }
            
            // Bind click event
            this.$element.on('click', this.openModal.bind(this));
        },

        openModal: function() {
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
                                <i class="bi bi-camera-reverse"></i> 🔄
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
            
            // Set frame if enabled
            const $frame = $('.frame-overlay');
            $frame.css('opacity', 0);
            
            if(this.frame && this.name) {
                $frame.css('background-image', `url(${this.settings.framePath}${this.name}.png)`);
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
            
            // Convert to base64
            const imageData = canvas.toDataURL('image/jpeg', 0.8);
            
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
                        const jpegBlob = await heic2any({
                            blob: file,
                            toType: 'image/jpeg',
                            quality: 0.8
                        });
                        
                        // Convert blob to base64
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
                    // Remove temporary input
                    $fileInput.remove();
                }
            });
            
            // Trigger file selection
            $fileInput.click();
        },

        updateInput: function() {
            if(this.multiple) {
                this.$input.val(JSON.stringify(this.images));
            } else {
                this.$input.val(this.images[0] || '');
            }
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