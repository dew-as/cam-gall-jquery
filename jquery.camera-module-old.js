/**
 * jQuery Camera Module Plugin
 * A plugin for capturing and previewing images with frame overlays
 * 
 * @version 1.0.0
 * @author Your Name
 */

(function($) {
  'use strict';

  // Default settings
  const defaults = {
    // Frame file names (without extension)
    frameFiles: {
      'front-view': 'front-view.png',
      'interior': 'interior.png',
      'lhside-view': 'lhside-view.png',
      'rhside-view': 'rhside-view.png'
    },
    // Base path for frame images
    frameBasePath: '',
    // Default camera facing mode
    defaultFacingMode: 'environment',
    // Callbacks
    onCapture: null,
    onError: null,
    onClose: null
  };

  // Plugin constructor
  function CameraModule(element, options) {
    this.$element = $(element);
    this.settings = $.extend({}, defaults, options);
    this.init();
  }

  // Plugin methods
  $.extend(CameraModule.prototype, {
    init: function() {
      // Initialize properties
      this.stream = null;
      this.currentStream = null;
      this.currentPreviewId = null;
      this.currentFrameType = null;
      this.currentOrientation = null;
      this.facingMode = this.settings.defaultFacingMode;
      this.deviceOrientation = window.orientation || 0;
      this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      this.frames = {};
      this.noFrame = false;

      // Cache DOM elements
      this.$cameraModal = $('.camera-modal');
      this.$cameraVideo = $('.camera-video');
      this.$frameOverlay = $('.frame-overlay');
      this.$captureBtn = $('.capture-btn');
      this.$switchBtn = $('.switch-camera');
      this.$closeBtn = $('.close-camera');

      // Initialize event listeners
      this.initEventListeners();

      // Bind context for event handlers
      this.handleOrientationChange = this.handleOrientationChange.bind(this);
      
      // Add orientation change listeners
      $(window)
        .on('orientationchange', this.handleOrientationChange)
        .on('resize', this.handleOrientationChange);
    },

    // Update frame size and position
    updateFrameSize: function() {
      if (this.noFrame) {
        this.$frameOverlay.hide();
        return;
      }


      if (!this.currentFrameType || !this.$frameOverlay.attr('src')) return;

      const frameImg = new Image();
      const $frameOverlay = this.$frameOverlay;
      
      frameImg.onload = function() {
        const isPortrait = this.currentOrientation === 'portrait';
        
        if (isPortrait) {
          $frameOverlay.css({
            'max-height': '80vh',
            'width': 'auto',
            'height': ''
          });
        } else {
          $frameOverlay.css({
            'max-width': '80vw',
            'height': 'auto',
            'width': ''
          });
        }
        
        // Center the frame
        $frameOverlay.css({
          'position': 'absolute',
          'top': '50%',
          'left': '50%',
          'transform': 'translate(-50%, -50%)'
        });
      }.bind(this);
      
      frameImg.src = this.$frameOverlay.attr('src');
    },

    // Update video transform based on device orientation and camera
    updateVideoTransform: function() {
      if (!this.$cameraVideo.length) return;

      // Reset transform first
      this.$cameraVideo.css('transform', '');

      // Get the current orientation
      let orientation = 0;
      if (window.screen && window.screen.orientation) {
        orientation = window.screen.orientation.angle;
      } else if (window.orientation !== undefined) {
        orientation = window.orientation;
      }

      // Calculate rotation based on device orientation
      let rotation = 0;
      let scaleX = 1;

      // For front camera, we need to mirror the video
      if (this.facingMode === 'user') {
        scaleX = -1;
      }

      // Apply rotation based on device orientation
      switch (orientation) {
        case 90: rotation = 90; break;
        case -90:
        case 270: // Some devices might report 270 instead of -90
          rotation = -90;
          break;
        case 180: rotation = 180; break;
        default: rotation = 0;
      }

      // Apply the transform
      this.$cameraVideo.css('transform', `scaleX(${scaleX}) rotate(${rotation}deg)`);

      // For iOS, we need to adjust the transform origin
      if (this.isIOS) {
        this.$cameraVideo.css({
          'transform-origin': 'center',
          '-webkit-transform-origin': 'center'
        });
      }
    },

    // Initialize event listeners
    initEventListeners: function() {
      // Camera trigger buttons
      $('.camera-trigger').on('click', (e) => {
        const $target = $(e.currentTarget);
        const previewId = $target.data('preview-id');
        const frameType = $target.data('frame-type');
        const orientation = $target.data('orientation') || 'landscape';
        const noFrame = $target.data('no-frame') === true;
        this.openCamera(previewId, frameType, orientation, noFrame);
      });

      // Camera controls
      this.$captureBtn.on('click', () => this.captureImage());
      this.$switchBtn.on('click', () => this.switchCamera());
      
      this.$closeBtn.on('click', () => this.closeCamera());
      
      // Close modal when clicking outside
      this.$cameraModal.on('click', (e) => {
        if (e.target === this.$cameraModal[0]) {
          this.closeCamera();
        }
      });
      
      // Handle window resize
      $(window).on('resize', () => {
        if (this.$cameraModal.is(':visible')) {
          this.updateFrameSize();
        }
      });
    },

    // Load frame image
    loadFrame: function(frameType) {
      // If no frame is needed, return empty string
      if (this.noFrame) {
        return Promise.resolve('');
      }
      
      // If frame is already loaded, return it
      if (this.frames[frameType]) {
        return Promise.resolve(this.frames[frameType]);
      }
      
      // Get the frame filename
      const frameFile = this.settings.frameFiles[frameType];
      if (!frameFile) {
        console.error(`Frame type '${frameType}' not found`);
        return Promise.resolve('');
      }
      
      // Create a promise to load the image
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
          this.frames[frameType] = img.src;
          resolve(img.src);
        };
        
        img.onerror = (error) => {
          console.error(`Error loading frame '${frameFile}':`, error);
          if (typeof this.settings.onError === 'function') {
            this.settings.onError('frame_load_error', `Failed to load frame: ${frameFile}`);
          }
          resolve('');
        };
        
        // Set the image source with cache busting
        img.src = `${this.settings.frameBasePath}${frameFile}?${new Date().getTime()}`;
      });
    },

    // Open camera with specified frame and orientation
    openCamera: async function(previewId, frameType, orientation = 'landscape', noFrame = false) {
      try {
        this.currentPreviewId = previewId;
        this.currentFrameType = frameType;
        this.currentOrientation = orientation;
        this.noFrame = noFrame;
        
        // Show the modal and make it full screen
        $('body').css('overflow', 'hidden');
        this.$cameraModal.css('display', 'flex');
        
        // Reset video and frame overlay styles
        this.$cameraVideo.css({
          'width': '100%',
          'height': '100%',
          'object-fit': 'cover'
        });
        
        this.$frameOverlay.css({
          'max-width': '90%',
          'max-height': '90%'
        });
        
        // Update video transform based on current orientation
        this.updateVideoTransform();
        
        // Load and set frame overlay
        const frameSrc = await this.loadFrame(frameType);
        
        if (frameSrc) {
          this.$frameOverlay.attr('src', frameSrc).show();
          
          // Adjust frame overlay size based on orientation
          const frameImg = new Image();
          frameImg.onload = () => {
            const isPortrait = orientation === 'portrait';
            
            if (isPortrait) {
              this.$frameOverlay.css({
                'max-height': '80vh',
                'width': 'auto',
                'height': ''
              });
            } else {
              this.$frameOverlay.css({
                'max-width': '80vw',
                'height': 'auto',
                'width': ''
              });
            }
          };
          frameImg.src = frameSrc;
        } else {
          this.$frameOverlay.hide();
        }
        
        // Stop any existing stream
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
        }
        
        // Get user media with constraints
        const constraints = {
          video: {
            facingMode: this.facingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        };
        
        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
        this.$cameraVideo[0].srcObject = this.stream;
        this.currentStream = this.stream;
        
        // Enable capture button once video is playing
        this.$cameraVideo.one('playing', () => {
          this.$captureBtn.prop('disabled', false);
        });
        
      } catch (error) {
        console.error('Error accessing camera:', error);
        const errorMsg = 'Could not access the camera. Please ensure you have granted camera permissions.';
        if (typeof this.settings.onError === 'function') {
          this.settings.onError('camera_access_error', errorMsg);
        } else {
          alert(errorMsg);
        }
        this.closeCamera();
      }
    },

    // Switch between front and back camera
    switchCamera: async function() {
      try {
        this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
        
        // Update video transform for the new camera
        this.updateVideoTransform();
        
        // Restart the camera with the new facing mode
        if (this.currentPreviewId && this.currentFrameType) {
          // Stop the current stream first
          if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
          }
          
          // Get user media with constraints
          const constraints = {
            video: {
              facingMode: this.facingMode,
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            },
            audio: false
          };
          
          this.stream = await navigator.mediaDevices.getUserMedia(constraints);
          this.$cameraVideo[0].srcObject = this.stream;
          this.currentStream = this.stream;
          
          // On iOS, we need to play the video to get the correct orientation
          if (this.isIOS) {
            await this.$cameraVideo[0].play();
          }
        }
      } catch (error) {
        console.error('Error switching camera:', error);
        // Revert the facing mode if there was an error
        this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
        
        if (typeof this.settings.onError === 'function') {
          this.settings.onError('camera_switch_error', 'Failed to switch camera');
        }
      }
    },

    // Capture image from video stream
    captureImage: function() {
      const canvas = document.createElement('canvas');
      const video = this.$cameraVideo[0];
      const isFrontCamera = this.facingMode === 'user';
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      
      if (isFrontCamera) {
        // For front camera, we need to mirror the image
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        
        // Check if we need to rotate the image based on device orientation
        const isPortrait = this.currentOrientation === 'portrait';
        if (isPortrait) {
          // For portrait mode, we need to handle rotation
          ctx.rotate(Math.PI / 2);
          ctx.translate(0, -canvas.width);
          // Swap width and height for portrait
          [canvas.width, canvas.height] = [canvas.height, canvas.width];
        }
      }
      
      // Draw video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert canvas to data URL
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      
      // Call the onCapture callback if provided
      if (typeof this.settings.onCapture === 'function') {
        this.settings.onCapture(imageDataUrl, this.currentPreviewId);
      }
      
      // Update preview
      this.updatePreview(this.currentPreviewId, imageDataUrl);
      
      // Close camera
      this.closeCamera();
    },

    // Update the preview with the captured image
    updatePreview: function(previewId, imageData) {
      const $previewContainer = $(`#${previewId}`);
      if (!$previewContainer.length) return;
      
      // Clear previous preview
      $previewContainer.empty();
      
      // Create preview container
      const $container = $('<div>').addClass('preview-container');
      
      // Create image element
      const $img = $('<img>')
        .attr('src', imageData)
        .attr('alt', 'Preview')
        .addClass('img-fluid');
      
      // Create remove button
      const $removeBtn = $('<button>')
        .addClass('remove-image')
        .html('×')
        .on('click', (e) => {
          e.stopPropagation();
          this.clearPreview(previewId);
        });
      
      // Append elements
      $container.append($img, $removeBtn);
      $previewContainer.append($container);
      
      // Update hidden input
      const $input = $(`#${previewId}-input`);
      if ($input.length) {
        $input.val(imageData);
      }
    },

    // Clear preview
    clearPreview: function(previewId) {
      const $previewContainer = $(`#${previewId}`);
      if ($previewContainer.length) {
        $previewContainer.empty();
        
        // Clear hidden input
        const $input = $(`#${previewId}-input`);
        if ($input.length) {
          $input.val('');
        }
      }
    },

    // Close camera and clean up
    closeCamera: function() {
      try {
        // Stop video stream
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
          this.stream = null;
        }
        
        // Clear video source
        if (this.$cameraVideo[0].srcObject) {
          this.$cameraVideo[0].srcObject = null;
        }
        
        // Reset frame overlay
        this.$frameOverlay.attr('src', '').hide();
        
        // Hide modal and restore body scroll
        this.$cameraModal.hide();
        $('body').css('overflow', '');
        
        // Reset capture button state
        this.$captureBtn.prop('disabled', true);
        
        // Call onClose callback if provided
        if (typeof this.settings.onClose === 'function') {
          this.settings.onClose();
        }
        
        // Reset current states
        this.currentPreviewId = null;
        this.currentFrameType = null;
        this.currentOrientation = null;
      } catch (error) {
        console.error('Error closing camera:', error);
        if (typeof this.settings.onError === 'function') {
          this.settings.onError('camera_close_error', 'Error while closing camera');
        }
      }
    },

    // Handle orientation change
    handleOrientationChange: function() {
      if (window.screen && window.screen.orientation) {
        this.deviceOrientation = window.screen.orientation.angle;
      } else if (window.orientation !== undefined) {
        this.deviceOrientation = window.orientation;
      }
      
      if (this.$cameraModal.is(':visible')) {
        this.updateVideoTransform();
        this.updateFrameSize();
      }
    },
    
    // Public method to open camera programmatically
    open: function(previewId, frameType, orientation = 'landscape', noFrame = false) {
      this.openCamera(previewId, frameType, orientation, noFrame);
    },
    
    // Public method to close camera programmatically
    close: function() {
      this.closeCamera();
    },
    
    // Public method to clear preview programmatically
    clear: function(previewId) {
      this.clearPreview(previewId);
    },
    
    // Public method to update settings
    updateSettings: function(newSettings) {
      this.settings = $.extend({}, this.settings, newSettings);
    }
  });

  // jQuery plugin definition
  $.fn.cameraModule = function(options) {
    return this.each(function() {
      if (!$.data(this, 'cameraModule')) {
        $.data(this, 'cameraModule', new CameraModule(this, options));
      }
    });
  };
  
  // Expose the CameraModule constructor
  $.fn.cameraModule.Constructor = CameraModule;
  
  // Auto-initialize if data-camera-module attribute is present
  $(document).ready(function() {
    $('[data-camera-module]').each(function() {
      const $this = $(this);
      const options = $this.data('camera-module-options') || {};
      $this.cameraModule(options);
    });
  });
  
})(jQuery);
