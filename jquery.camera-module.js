/**
 * jQuery Camera Gallery Plugin
 * A plugin for capturing and selecting images with frame overlays
 * 
 * @version 2.0.0
 * @license MIT
 */

(function($) {
  'use strict';

  // Default settings
  const defaults = {
    framePath: 'frames/',  // Path to frame images
    defaultFacingMode: 'environment',
    // Callbacks
    onCapture: null,
    onError: null,
    onClose: null,
    onUpdate: null
  };

  // Plugin constructor
  function CameraGallery(element, options) {
    this.$element = $(element);
    this.settings = $.extend({}, defaults, options);
    this.currentImages = [];
    this.currentInput = null;
    this.multiple = false;
    this.showFrame = false;
    this.showPreview = false;
    this.frameName = '';
    this.init();
  }

  // Plugin methods
  $.extend(CameraGallery.prototype, {
    init: function() {
      // Cache modal elements
      this.$modal = $('#cameraModal');
      this.$cameraOptions = this.$modal.find('.camera-options');
      this.$cameraInterface = this.$modal.find('.camera-interface');
      this.$galleryInterface = this.$modal.find('.gallery-interface');
      this.$previewContainer = this.$modal.find('.preview-container');
      this.$previewImages = this.$modal.find('.preview-images');
      this.$galleryInput = this.$modal.find('.gallery-input');
      
      // Camera elements
      this.$cameraVideo = this.$modal.find('.camera-video');
      this.$frameOverlay = this.$modal.find('.frame-overlay');
      this.$captureBtn = this.$modal.find('.capture-btn');
      this.$switchBtn = this.$modal.find('.switch-camera');
      
      // State
      this.stream = null;
      this.facingMode = this.settings.defaultFacingMode;
      this.currentImage = null;
      
      // Initialize event listeners
      this.initEventListeners();
      
      // Auto-initialize if data attributes are present
      this.initializeFromDataAttributes();
    },
    
    initializeFromDataAttributes: function() {
      const self = this;
      
      this.$element.on('click', function(e) {
        e.preventDefault();
        
        // Get data attributes
        const $btn = $(this);
        const inputName = $btn.data('cg-name');
        const $input = $(`input[name="${inputName}"]`);
        
        if (!$input.length) {
          console.error(`No input found with name: ${inputName}`);
          return;
        }
        
        // Set current state
        self.currentInput = $input;
        self.currentInputName = inputName; // Ensure this is set
        self.multiple = $btn.data('cg-multiple') || false;
        self.showFrame = $btn.data('cg-frame') || false;
        self.showPreview = $btn.data('cg-preview') || false;
        self.frameName = $btn.data('cg-name') || '';
        
        // Load existing images if any
        try {
          const inputVal = $input.val();
          if (inputVal) {
            self.currentImages = self.multiple ? JSON.parse(inputVal) : [inputVal];
            if (!Array.isArray(self.currentImages)) {
              self.currentImages = [self.currentImages];
            }
          } else {
            self.currentImages = [];
          }
        } catch (e) {
          console.error('Error parsing input value:', e);
          self.currentImages = [];
        }
        
        // Show the modal with options
        self.showOptions();
      });
    },
    
    showOptions: function() {
      this.resetModal();
      this.$cameraOptions.show();
      this.$modal.show();
      $('body').css('overflow', 'hidden');
    },
    
    showCamera: function() {
      this.resetModal();
      this.$cameraInterface.show();
      this.initializeCamera();
    },
    
    showGallery: function() {
      this.resetModal();
      this.$galleryInterface.show();
      this.$galleryInput.trigger('click');
    },
    
    showPreview: function() {
      this.resetModal();
      this.renderPreview();
      this.$previewContainer.show();
    },
    
    renderPreview: function() {
      const self = this;
      let html = '';
      
      if (this.currentImages.length === 0) {
        html = '<p>No images selected</p>';
      } else {
        this.currentImages.forEach((img, index) => {
          html += `
            <div class="preview-item position-relative d-inline-block me-2 mb-2">
              <img src="${img}" class="img-thumbnail" style="width: 100px; height: 100px; object-fit: cover;">
              <button class="btn btn-sm btn-danger remove-image" data-index="${index}" style="position: absolute; top: 0; right: 0;">
                <i class="bi bi-x"></i>
              </button>
            </div>
          `;
        });
      }
      
      this.$previewImages.html(html);
      
      // Add event for remove buttons
      this.$previewImages.find('.remove-image').on('click', function() {
        const index = $(this).data('index');
        self.removeImage(index);
      });
    },
    
    removeImage: function(index) {
      this.currentImages.splice(index, 1);
      this.updateInput();
      this.renderPreview();
    },
    
    updateInput: function() {
      // Don't update if we don't have a valid input name
      if (!this.currentInputName) return;
      
      // Find the input by name if we don't have a direct reference
      if (!this.currentInput || !this.currentInput.length) {
        this.currentInput = $(`[name="${this.currentInputName}"]`);
        if (!this.currentInput.length) return;
      }
      
      if (this.multiple) {
        this.currentInput.val(JSON.stringify(this.currentImages));
      } else {
        this.currentInput.val(this.currentImages[0] || '');
      }
      
      // Trigger change event
      this.currentInput.trigger('change');
      
      if (typeof this.settings.onUpdate === 'function') {
        this.settings.onUpdate(this.currentImages);
      }
    },
    
    resetModal: function() {
      this.$cameraOptions.hide();
      this.$cameraInterface.hide();
      this.$galleryInterface.hide();
      this.$previewContainer.hide();
      this.stopCamera();
    },
    
    initializeCamera: function() {
      const self = this;
      const constraints = {
        video: {
          facingMode: this.facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };
      
      // Stop any existing stream
      this.stopCamera();
      
      // Show loading state
      this.$cameraVideo.hide();
      
      // Clear previous frame
      this.$frameOverlay.hide().removeAttr('src');
      this.currentFrame = null;
      
      // Only set up frame overlay if explicitly enabled
      if (this.showFrame === true && this.frameName) {
        const frameSrc = this.settings.framePath + this.frameName + '.png';
        const frame = new Image();
        frame.crossOrigin = 'anonymous';
        
        frame.onload = () => {
          // Set the frame source and make it visible
          this.$frameOverlay.attr('src', frameSrc).css({
            'position': 'absolute',
            'top': '0',
            'left': '0',
            'width': '100%',
            'height': '100%',
            'object-fit': 'contain',
            'pointer-events': 'none',
            'z-index': '2'
          }).show();
          
          // Set the frame as a property for later use in capture
          this.currentFrame = frame;
        };
        
        frame.onerror = () => {
          console.error('Error loading frame:', frameSrc);
          this.currentFrame = null;
        };
        
        frame.src = frameSrc;
      } else {
        this.currentFrame = null;
      }
      
      // Request camera access
      navigator.mediaDevices.getUserMedia(constraints)
        .then(function(stream) {
          self.stream = stream;
          const video = self.$cameraVideo[0];
          video.srcObject = stream;
          
          // Wait for video to be ready
          return new Promise((resolve) => {
            video.onloadedmetadata = () => {
              video.play().then(() => {
                self.$cameraVideo.show();
                resolve();
              });
            };
          });
        })
        .catch(function(error) {
          console.error('Error accessing camera:', error);
          if (self.settings.onError) {
            self.settings.onError('camera_error', 'Could not access the camera');
          }
        });
    },
    
    captureImage: function() {
      const video = this.$cameraVideo[0];
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw video frame to canvas - this is the actual image without any frame
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Get the image data directly without any frame overlay
      const imageData = canvas.toDataURL('image/jpeg');
      this.processCapturedImage(imageData);
      return Promise.resolve();
    },
    
    processCapturedImage: function(imageData) {
      // Add to current images
      if (this.multiple) {
        this.currentImages.push(imageData);
      } else {
        this.currentImages = [imageData];
      }
      
      // Update input
      this.updateInput();
      
      // Show preview or confirm selection based on settings
      if (this.showPreview) {
        this.renderPreview();
        this.$previewContainer.show();
        this.$cameraInterface.hide();
        this.$galleryInterface.hide();
        this.$cameraOptions.hide();
      } else {
        this.confirmSelection();
      }
    },
    
    stopCamera: function() {
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }
      this.$cameraVideo[0].srcObject = null;
    },
    
    switchCamera: function() {
      this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
      this.stopCamera();
      this.initializeCamera();
    },
    
    closeModal: function() {
      this.stopCamera();
      this.$modal.hide();
      $('body').css('overflow', '');
      
      if (typeof this.settings.onClose === 'function') {
        this.settings.onClose();
      }
    },
    
    confirmSelection: function() {
      try {
        // Only update if we have images
        if (this.currentImages && this.currentImages.length > 0) {
          // If not multiple, only keep the latest image
          if (!this.multiple && this.currentImages.length > 1) {
            this.currentImages = [this.currentImages[this.currentImages.length - 1]];
          }
          
          // Get the input name safely
          const inputName = this.currentInput ? 
            (this.currentInput.attr ? this.currentInput.attr('name') : '') : 
            (this.currentInputName || '');
          
          // Update the input value
          this.updateInput();
          
          // Trigger capture callback
          if (typeof this.settings.onCapture === 'function') {
            this.settings.onCapture(this.currentImages, inputName);
          }
        }
      } catch (error) {
        console.error('Error in confirmSelection:', error);
      } finally {
        this.closeModal();
      }
    },
    
    handleGallerySelect: function(event) {
      const files = event.target.files;
      if (!files.length) return;
      
      const self = this;
      let filesProcessed = 0;
      
      Array.from(files).forEach(file => {
        if (!file.type.match('image.*')) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
          if (self.multiple) {
            self.currentImages.push(e.target.result);
          } else {
            self.currentImages = [e.target.result];
          }
          
          filesProcessed++;
          if (filesProcessed === files.length) {
            self.updateInput();
            self.showPreview();
          }
        };
        reader.readAsDataURL(file);
      });
    },
    
    initEventListeners: function() {
      const self = this;
      
      // Camera options
      this.$modal.find('.use-camera').on('click', () => this.showCamera());
      this.$modal.find('.use-gallery').on('click', () => this.showGallery());
      this.$modal.find('.back-to-options').on('click', () => this.showOptions());
      this.$modal.find('.close-modal').on('click', () => this.closeModal());
      
      // Camera controls
      this.$captureBtn.on('click', () => this.captureImage());
      this.$switchBtn.on('click', () => this.switchCamera());
      
      // Gallery input
      this.$galleryInput.on('change', (e) => this.handleGallerySelect(e));
      
      // Confirm selection
      this.$modal.find('.confirm-selection').on('click', () => this.confirmSelection());
      
      // Close modal when clicking outside
      this.$modal.on('click', function(e) {
        if (e.target === this) {
          self.closeModal();
        }
      });
      
      // Handle escape key
      $(document).on('keydown.cameraGallery', function(e) {
        if (e.key === 'Escape') {
          self.closeModal();
        }
      });
    },
    
    destroy: function() {
      this.stopCamera();
      $(document).off('.cameraGallery');
      this.$element.off('click');
    }
  });

  // jQuery plugin definition
  function cameraGallery(options) {
    return this.each(function() {
      const $this = $(this);
      let data = $this.data('camera-gallery');
      
      if (!data) {
        data = new CameraGallery(this, options);
        $this.data('camera-gallery', data);
      }
      
      if (typeof options === 'string') {
        if (data[options]) {
          data[options]();
        }
      }
    });
  }
  
  // Expose the CameraGallery constructor
  $.fn.cameraGallery = cameraGallery;
  $.fn.cameraGallery.Constructor = CameraGallery;
  
  // Auto-initialize if data-camera-gallery attribute is present
  $(document).ready(function() {
    $('[data-camera-gallery]').cameraGallery();
  });
  
})(jQuery);
