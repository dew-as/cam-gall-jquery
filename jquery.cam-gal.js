(function ($) {
  "use strict";

  // Default settings
  const defaults = {
    defaultFacingMode: "environment",
  };

  // Plugin constructor
  function CamGal(element, options) {
    this.$element = $(element);
    this.settings = $.extend({}, defaults, options);
    this.initialized = false;
    console.log('CamGal initialized with settings:', this.settings);
    this.init();
  }

  // Helper function to check if string is base64
  function isBase64(str) {
    if (typeof str !== 'string') return false;
    try {
      return /^data:image\/[a-z]+;base64,/.test(str) || 
             /^[A-Za-z0-9+/=]+$/.test(str.replace(/^data:image\/[a-z]+;base64,/, ''));
    } catch (e) {
      return false;
    }
  }

  // Function to convert image URL to base64
  function urlToBase64(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      
      img.onload = function() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.height = img.naturalHeight;
        canvas.width = img.naturalWidth;
        ctx.drawImage(img, 0, 0);
        
        try {
          const dataUrl = canvas.toDataURL('image/jpeg');
          resolve(dataUrl);
        } catch (e) {
          // If conversion fails, return the original URL
          resolve(url);
        }
      };
      
      img.onerror = function() {
        // If image fails to load, return the original URL
        resolve(url);
      };
      
      img.src = url;
    });
  }

  // Plugin methods
  CamGal.prototype = {
    // Initialize the plugin
    init: function () {
      if (this.initialized) return;
      
      this.name = this.$element.data("cg-name") || "image";
      this.multiple = this.$element.data("cg-multiple") || false;
      this.framePath = this.$element.data("cg-frame") || "";
      this.preview = this.$element.data("cg-preview") !== false;
      this.actionUrl = this.settings.actionUrl;
      
      console.log('Initialized with:', {
        name: this.name,
        multiple: this.multiple,
        actionUrl: this.actionUrl,
        element: this.$element
      });
      this.images = [];
      
      // Use existing inputs container or create a new one
      this.inputsContainer = this.$element.siblings('.cam-gal-inputs').first();
      if (this.inputsContainer.length === 0) {
        this.inputsContainer = $(`<div class="cam-gal-inputs"></div>`);
        this.$element.after(this.inputsContainer);
      }

      // Load existing values if any
      this.loadExistingValues();

      // Bind events
      this.bindEvents();
      
      this.initialized = true;
    },

    bindEvents: function () {
      // Bind click event
      this.$element.on("click", this.openModal.bind(this));
    },

    openModal: async function () {
      console.log('Opening modal with images:', this.images);
      const self = this;

      // Create modal if doesn't exist
      if (!$("#cam-gal-modal").length) {
        this.createModal();
      }

      // Store current instance
      $("#cam-gal-modal").data("current-instance", this);

      // Show loading state
      $("#cam-gal-options").hide();
      $("#cam-gal-preview").hide();
      
      // Create loading overlay
      const $loadingOverlay = $(
        '<div class="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex justify-content-center align-items-center" style="z-index: 3000;">' +
        '<div class="text-center text-white">' +
          '<div class="spinner-border mb-2" role="status">' +
            '<span class="visually-hidden">Loading...</span>' +
          '</div>' +
          '<p>Loading images...</p>' +
        '</div>' +
        '</div>'
      );
      
      $('body').append($loadingOverlay);
      
      try {
        // Process each image
        const imagePromises = this.images.map(async (img, i) => {
          if (img && !isBase64(img) && (img.startsWith('http') || img.startsWith('//') || img.startsWith('/'))) {
            try {
              console.log('Converting URL to base64:', img);
              const base64Image = await urlToBase64(img);
              if (base64Image) {
                self.images[i] = base64Image;
                console.log('Successfully converted to base64');
              }
            } catch (e) {
              console.warn('Failed to convert image to base64:', e);
            }
          }
          return self.images[i];
        });
        
        // Wait for all conversions to complete
        await Promise.all(imagePromises);
        
        // Update the hidden inputs with base64 data
        this.updateInput();
        
        // Show preview or options
        if (this.preview && this.images.length > 0) {
          this.showPreview();
        } else {
          this.showOptions();
        }
        
        // Show modal
        $("#cam-gal-modal").fadeIn();
        $("body").css("overflow", "hidden");
        
      } catch (e) {
        console.error('Error in openModal:', e);
        this.showOptions();
      } finally {
        $loadingOverlay.remove();
      }
    },

    createModal: function () {
      // Create modal structure
      const modalHTML = `
            <div id="cam-gal-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:2000;">
                <div style="position:relative; max-width:500px; margin:50px auto; background:#fff; border-radius:8px; padding:20px;">
                    <!-- Close Button (Top Right) -->
                    <button class="btn btn-link p-0 position-absolute cam-gal-close" style="top: 10px; right: 10px; font-size: 1.5rem; line-height: 1; color: #6c757d;">
                        <i class="bi bi-x"></i>
                    </button>
                    
                    <!-- Options View -->
                    <div id="cam-gal-options" style="display:none;">
                        <h4 class="text-center mb-4">Pick Image</h4>
                        <div class="d-flex justify-content-center gap-3">
                            <button class="btn btn-primary cam-gal-option" data-type="camera" style="min-width: 100px;">
                                <i class="bi bi-camera me-2"></i>Camera
                            </button>
                            <button class="btn btn-secondary cam-gal-option" data-type="gallery" style="min-width: 100px;">
                                <i class="bi bi-images me-2"></i>Gallery
                            </button>
                        </div>
                    </div>
                    
                    <!-- Preview View -->
                    <div id="cam-gal-preview" style="display:none;">
                        <h4 class="text-center mb-3">Preview</h4>
                        <div class="preview-images d-flex flex-wrap gap-2 mb-3"></div>
                        <div class="d-flex justify-content-center gap-2">
                            <!-- Buttons will be shown/hidden dynamically in showPreview() -->
                            <button class="btn btn-primary cam-gal-add" style="display:none;">Add +</button>
                            <button class="btn btn-success cam-gal-ok" style="display:none;">OK</button>
                        </div>
                    </div>
                    
                    <!-- Camera View -->
                    <div id="cam-gal-camera" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:#000;">
                        <div class="camera-top-bar" style="position:absolute; top:0; left:0; width:100%; padding:15px; display:flex; justify-content:space-between; z-index:1001;">
                            <button class="btn btn-sm btn-light cam-gal-close-camera">
                                <i class="bi bi-arrow-left"></i>
                            </button>
                            <button class="btn btn-sm btn-light cam-gal-switch-camera">
                                <i class="bi bi-arrow-repeat"></i>
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
                </div>
            </div>`;

      // Add style for front camera mirroring if not present
      if (!$("#cam-gal-front-camera-style").length) {
        const css = `
            #cam-gal-modal .front-camera {
                transform: scaleX(-1);
            }
        `;
        $("head").append(
          $("<style>", {
            id: "cam-gal-front-camera-style",
            text: css,
          })
        );
      }

      $("body").append(modalHTML);

      // Add event listeners
      this.addModalListeners();
    },

    addModalListeners: function () {
      const self = this;

      // Option selection
      $(document).on("click", ".cam-gal-option", function () {
        const type = $(this).data("type");
        const instance = $("#cam-gal-modal").data("current-instance");

        if (type === "camera") {
          instance.showCamera();
        } else {
          instance.openGallery();
        }
      });

      // Back to options
      $(document).on("click", ".cam-gal-back", function () {
        $("#cam-gal-preview").hide();
        $("#cam-gal-options").show();
      });

      // Add more images
      $(document).on("click", ".cam-gal-add", function () {
        const instance = $("#cam-gal-modal").data("current-instance");
        $("#cam-gal-preview").hide();
        $("#cam-gal-options").show();
      });

      // Close button - using direct delegation to handle dynamically added elements
      $(document).off('click', '.cam-gal-close').on('click', '.cam-gal-close', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const $modal = $('#cam-gal-modal');
        const instance = $modal.data('current-instance');
        
        // Always close the modal when the X button is clicked
        $modal.stop().fadeOut(300, function() {
          $('body').css('overflow', '');
        });
        
        // If in single image mode with no images, show options when modal is opened next time
        if (instance && !instance.multiple && instance.images.length === 0) {
          setTimeout(() => {
            instance.showOptions();
          }, 350);
        }
        
        return false;
      });

      // OK button in preview
      $(document).on('click', '.cam-gal-ok', function() {
        console.log('OK button clicked');
        const $modal = $('#cam-gal-modal');
        const instance = $modal.data('current-instance');
        
        console.log('Modal instance:', instance);
        
        if (instance) {
          console.log('Action URL:', instance.actionUrl);
          console.log('Images to send:', instance.images);
          // Create FormData to send
          const formData = new FormData();
          
          // Add images to form data
          if (instance.multiple) {
            // For multiple images, send as array
            instance.images.forEach((img, index) => {
              formData.append(`${instance.name}[]`, img);
            });
          } else if (instance.images.length > 0) {
            // For single image, send as single field
            formData.append(instance.name, instance.images[0]);
          }
          
          // Add any additional data
          formData.append('timestamp', new Date().toISOString());
          
          // Only proceed if we have an action URL and at least one image
          if (instance.actionUrl && instance.images.length > 0) {
            // Show loading state
            const $okBtn = $(this).prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Sending...');
            
            // Send AJAX request
            console.log('Sending AJAX request with form data');
            $.ajax({
              url: instance.actionUrl,
              type: 'POST',
              data: formData,
              processData: false,
              contentType: false,
              headers: {
                'X-Requested-With': 'XMLHttpRequest'
              },
              beforeSend: function(xhr) {
                console.log('AJAX request being sent');
              },
              success: function(response) {
                console.log('Images uploaded successfully:', response);
              },
              error: function(xhr, status, error) {
                console.error('Error uploading images:', error);
                alert('Error uploading images. Please try again.');
              },
              complete: function() {
                // Close modal and clean up
                $modal.fadeOut(300, function() {
                  $('body').css('overflow', '');
                  $okBtn.prop('disabled', false).text('OK');
                });
              }
            });
          } else {
            // No action URL or no images, just close the modal
            $modal.fadeOut(300, function() {
              $('body').css('overflow', '');
            });
          }
        }
      });

      // Camera controls
      $(document).on("click", ".cam-gal-close-camera", function () {
        const instance = $("#cam-gal-modal").data("current-instance");
        instance.stopCamera();
        $("#cam-gal-camera").hide();
        $("#cam-gal-options").show();
      });

      $(document).on("click", ".cam-gal-switch-camera", function () {
        const instance = $("#cam-gal-modal").data("current-instance");
        instance.switchCamera();
      });

      $(document).on("click", ".capture-btn", function () {
        const instance = $("#cam-gal-modal").data("current-instance");
        instance.captureImage();
      });
    },

    showOptions: function () {
      $("#cam-gal-options").show();
      $("#cam-gal-preview").hide();
      $("#cam-gal-camera").hide();
    },

    showPreview: function () {
      $('#cam-gal-options').hide();
      $('#cam-gal-camera').hide();
      const $preview = $('#cam-gal-preview');
      const $previewImages = $preview.find('.preview-images').empty();

      // Show the preview section
      $preview.show();

      // Add all images to preview
      this.images.forEach((img, index) => {
        const $imgContainer = $('<div class="position-relative" style="width: 100px; height: 100px; overflow: hidden;"></div>');
        const $img = $('<img>', {
          src: img,
          class: 'img-thumbnail w-100 h-100 object-fit-cover',
          style: 'cursor: pointer;',
          'data-index': index
        });
        
        // Add delete button
        const $deleteBtn = $('<button class="btn btn-danger btn-sm position-absolute top-0 end-0 m-1 rounded-circle" style="width: 24px; height: 24px; padding: 0; line-height: 1;">' +
          '<i class="bi bi-x"></i>' +
          '</button>');
        
        $imgContainer.append($img, $deleteBtn);
        $previewImages.append($imgContainer);
        
        // Handle image click for fullscreen
        $img.on('click', (e) => {
          if (e.target !== $deleteBtn[0] && !$deleteBtn.has(e.target).length) {
            this.showFullscreenPreview(img);
          }
        });
        
        // Handle delete button click
        $deleteBtn.on('click', (e) => {
          e.stopPropagation();
          this.removeImage(index);
          // If in single image mode and no images left, go back to options
          if (!this.multiple && this.images.length === 0) {
            this.showOptions();
          } else {
            this.showPreview(); // Refresh preview
          }
        });
      });
      
      // Show/hide buttons based on single/multiple mode
      const $addBtn = $preview.find('.cam-gal-add');
      const $okBtn = $preview.find('.cam-gal-ok');
      
      if (this.multiple) {
        // Multiple images mode: Show Add + and OK buttons
        $addBtn.show();
        $okBtn.show();
      } else {
        // Single image mode: Show only OK button when there's an image
        $addBtn.hide();
        $okBtn.toggle(this.images.length > 0);
      }
    },

    showFullscreenPreview: function (imageSrc) {
      // Create fullscreen preview if it doesn't exist
      let $fullscreenPreview = $("#cam-gal-fullscreen-preview");

      if ($fullscreenPreview.length === 0) {
        $("body").append(`
                    <div id="cam-gal-fullscreen-preview" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:3000; display:flex; justify-content:center; align-items:center; flex-direction:column;">
                        <button class="btn btn-light" style="position:absolute; top:20px; left:20px;">
                            <i class="bi bi-arrow-left"></i> Back
                        </button>
                        <img src="${imageSrc}" style="max-width:90%; max-height:80vh; object-fit:contain;">
                    </div>
                `);
        $fullscreenPreview = $("#cam-gal-fullscreen-preview");

        // Handle back button click
        $fullscreenPreview.find("button").on("click", () => {
          $fullscreenPreview.remove();
        });

        // Close on escape key
        $(document).on("keyup.fullscreenPreview", (e) => {
          if (e.key === "Escape") {
            $fullscreenPreview.remove();
            $(document).off("keyup.fullscreenPreview");
          }
        });

        // Close on backdrop click
        $fullscreenPreview.on("click", (e) => {
          if (e.target === $fullscreenPreview[0]) {
            $fullscreenPreview.remove();
            $(document).off("keyup.fullscreenPreview");
          }
        });
      } else {
        $fullscreenPreview.find("img").attr("src", imageSrc);
      }

      $fullscreenPreview.show();
    },

    removeImage: function (index) {
      this.images.splice(index, 1);
      this.updateInput();
      this.showPreview();
    },

    showCamera: function () {
      $("#cam-gal-options").hide();
      $("#cam-gal-preview").hide();
      $("#cam-gal-camera").show();

      // Set frame if path is provided
      const $frame = $(".frame-overlay");
      $frame.css("opacity", 0);

      if (this.framePath) {
        $frame.css("background-image", `url(${this.framePath})`);
        $frame.css("opacity", 1);
      }

      this.startCamera();
    },

    startCamera: function () {
      const self = this;
      const $video = $(".cam-gal-video");

      // Stop any existing stream
      this.stopCamera();

      // Constraints
      const constraints = {
        video: {
          facingMode: this.facingMode || "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      // Request camera
      navigator.mediaDevices
        .getUserMedia(constraints)
        .then(function (stream) {
          self.stream = stream;
          $video[0].srcObject = stream;

          // Set front camera mirror effect
          $video.toggleClass(
            "front-camera",
            constraints.video.facingMode === "user"
          );

          return new Promise((resolve) => {
            $video[0].onloadedmetadata = () => {
              $video[0].play().then(resolve);
            };
          });
        })
        .catch(function (error) {
          console.error("Camera error:", error);
          alert("Could not access the camera. Please check permissions.");
          self.showOptions();
        });
    },

    stopCamera: function () {
      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop());
        this.stream = null;
      }
    },

    switchCamera: function () {
      this.facingMode = this.facingMode === "user" ? "environment" : "user";
      this.stopCamera();
      this.startCamera();
    },

    captureImage: function () {
      const $video = $(".cam-gal-video")[0];
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // Set canvas dimensions
      canvas.width = $video.videoWidth;
      canvas.height = $video.videoHeight;

      // Draw video frame to canvas
      ctx.drawImage($video, 0, 0, canvas.width, canvas.height);

      // Convert to base64 with maximum quality
      const imageData = canvas.toDataURL("image/jpeg", 1.0);

      // Add to images
      if (this.multiple) {
        this.images.push(imageData);
      } else {
        this.images = [imageData];
      }

      // Update input
      this.updateInput();

      // Show preview or close camera
      if (this.preview) {
        this.stopCamera();
        this.showPreview();
      } else if (!this.multiple) {
        this.stopCamera();
        $("#cam-gal-camera").hide();
        $("#cam-gal-modal").fadeOut();
        $("body").css("overflow", "");
      }
    },

    openGallery: function () {
      // Create temporary file input with explicit MIME types including HEIC/HEIF
      const $fileInput = $(
        '<input type="file" accept="image/*,.heic,.heif,image/heic,image/heif" style="display:none;">'
      );

      if (this.multiple) {
        $fileInput.attr("multiple", true);
      }

      $("body").append($fileInput);

      $fileInput.on("change", async (e) => {
        const files = e.target.files;
        if (!files.length) return;

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
        $("body").append($loadingOverlay);

        try {
          let file = files[0];
          let imageData;

          // Check if file is HEIC/HEIF
          const isHeic =
            file.name.toLowerCase().endsWith(".heic") ||
            file.name.toLowerCase().endsWith(".heif") ||
            file.type === "image/heic" ||
            file.type === "image/heif";

          if (isHeic && typeof heic2any !== "undefined") {
            // Convert HEIC to JPEG
            $loadingOverlay.find("p").text("Converting HEIC to JPEG...");
            const jpegBlob = await heic2any({
              blob: file,
              toType: "image/jpeg",
              quality: 1.0,
            });

            // Convert blob to base64
            $loadingOverlay.find("p").text("Processing image...");
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
          if (this.multiple) {
            this.images.push(imageData);
          } else {
            this.images = [imageData];
          }

          // Update input
          this.updateInput();

          // Show preview or close modal
          if (this.preview) {
            this.showPreview();
          } else {
            $("#cam-gal-modal").fadeOut();
            $("body").css("overflow", "");
          }
        } catch (error) {
          console.error("Error processing image:", error);
          alert("Error processing the image. Please try another image.");
        } finally {
          // Remove loading overlay and temporary input
          $loadingOverlay.remove();
          $fileInput.remove();
        }
      });

      // Trigger file selection
      $fileInput.click();
    },

    loadExistingValues: function () {
      // Get all existing inputs within our container
      const existingInputs = this.inputsContainer.find(`input[type="hidden"][name^="${this.name}"]`);
      
      if (existingInputs.length > 0) {
        // If we found existing inputs, load their values
        this.images = existingInputs
          .map(function () {
            return $(this).val();
          })
          .get()
          .filter(Boolean);
      } else {
        // Check for any inputs with the same name in the document
        const otherInputs = $(`input[type="hidden"][name^="${this.name}"]`).not(this.inputsContainer.find('input'));
        if (otherInputs.length > 0) {
          this.images = otherInputs
            .map(function () {
              const val = $(this).val();
              $(this).remove(); // Remove the old input
              return val;
            })
            .get()
            .filter(Boolean);
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
      }

      // Filter out any empty values
      this.images = this.images.filter((img) => img && typeof img === 'string');

      // Update the inputs to match the loaded values
      if (this.images.length > 0) {
        this.updateInput();
      } else {
        // Ensure we have at least one empty input
        this.updateInput();
      }
    },

    updateInput: function () {
      // Don't update if we're in the middle of initializing
      if (!this.initialized) return;
      
      // Clear existing inputs
      this.inputsContainer.empty();

      if (this.images.length === 0) {
        // If no images, ensure we have at least one empty input
        const inputName = this.multiple ? `${this.name}[]` : this.name;
        const input = $(`<input type="hidden" name="${inputName}">`);
        this.inputsContainer.append(input);
        return;
      }

      if (this.multiple) {
        // For multiple images, create an input for each image
        this.images.forEach((image) => {
          if (!image) return;
          const input = $(`<input type="hidden" name="${this.name}[]">`);
          // Properly escape the value to prevent XSS and handle special characters
          const escapedValue = $('<div>').text(image).html();
          input.val(escapedValue);
          this.inputsContainer.append(input);
        });
      } else {
        const input = $(`<input type="hidden" name="${this.name}">`);
        // Properly escape the value to prevent XSS and handle special characters
        const escapedValue = $('<div>').text(this.images[0] || '').html();
        input.val(escapedValue);
        this.inputsContainer.append(input);
      }

      // Trigger change event on the container for any external listeners
      this.inputsContainer.trigger("change");
    },

    destroy: function () {
      this.stopCamera();
      this.$element.off("click");
      $("#cam-gal-modal").remove();
    },
  };

  // jQuery plugin definition
  $.fn.camGal = function (options) {
    return this.each(function () {
      if (!$.data(this, "camGal")) {
        $.data(this, "camGal", new CamGal(this, options));
      }
    });
  };
})(jQuery);
