// Camera Module for Vehicle Inspection
class CameraModule {
  constructor() {
    // DOM Elements
    this.cameraModal = document.getElementById('cameraModal');
    this.cameraVideo = document.getElementById('cameraVideo');
    this.frameOverlay = document.getElementById('frameOverlay');
    this.captureBtn = document.getElementById('captureBtn');
    this.switchBtn = document.getElementById('switchCamera');
    this.galleryBtn = document.getElementById('galleryBtn');
    this.galleryInput = document.getElementById('galleryInput');
    this.closeBtn = document.getElementById('closeCamera');
    
    // Camera state
    this.stream = null;
    this.currentStream = null;
    this.currentPreviewId = null;
    this.currentFrameType = null;
    this.currentOrientation = null;
    this.facingMode = 'environment';
    this.deviceOrientation = window.orientation || 0;
    this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    
    // Frame file names (without extension)
    this.frameFiles = {
      'front-view': 'front-view.png',
      'interior': 'interior.png',
      'lhside-view': 'lhside-view.png',
      'rhside-view': 'rhside-view.png'
    };
    
    // Base path for frame images (same as HTML file)
    this.frameBasePath = '';
    
    // Store loaded frames
    this.frames = {};
    
    // Bind event handlers
    this.initEventListeners();
    
    // Listen for device orientation changes
    this.handleOrientationChange = this.handleOrientationChange.bind(this);
    window.addEventListener('orientationchange', this.handleOrientationChange);
    window.addEventListener('resize', this.handleOrientationChange);
  }
  
  // Update frame size and position
  updateFrameSize() {
    // If no frame is needed, hide the frame overlay
    if (this.noFrame) {
      this.frameOverlay.style.display = 'none';
      return;
    }
    
    if (!this.currentFrameType || !this.frameOverlay.src) return;
    
    const frameImg = new Image();
    frameImg.onload = () => {
      const isPortrait = this.currentOrientation === 'portrait';
      const frameAspect = frameImg.width / frameImg.height;
      const windowAspect = window.innerWidth / window.innerHeight;
      
      if (isPortrait) {
        // For portrait, limit by height
        this.frameOverlay.style.maxHeight = '80vh';
        this.frameOverlay.style.width = 'auto';
      } else {
        // For landscape, limit by width
        this.frameOverlay.style.maxWidth = '80vw';
        this.frameOverlay.style.height = 'auto';
      }
      
      // Center the frame
      this.frameOverlay.style.position = 'absolute';
      this.frameOverlay.style.top = '50%';
      this.frameOverlay.style.left = '50%';
      this.frameOverlay.style.transform = 'translate(-50%, -50%)';
    };
    frameImg.src = this.frameOverlay.src;
  }
  
  // Update video transform based on device orientation and camera
  updateVideoTransform() {
    if (!this.cameraVideo) return;
    
    // Reset transform first
    this.cameraVideo.style.transform = '';
    
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
      case 90:
        rotation = 90;
        break;
      case -90:
      case 270: // Some devices might report 270 instead of -90
        rotation = -90;
        break;
      case 180:
        rotation = 180;
        break;
      default:
        rotation = 0;
    }
    
    // Apply the transform
    this.cameraVideo.style.transform = `scaleX(${scaleX}) rotate(${rotation}deg)`;
    
    // For iOS, we need to adjust the transform origin
    if (this.isIOS) {
      this.cameraVideo.style.transformOrigin = 'center';
      this.cameraVideo.style.webkitTransformOrigin = 'center';
    }
  }
  
  // Initialize event listeners
  initEventListeners() {
    // Camera trigger buttons
    document.querySelectorAll('.camera-trigger').forEach(button => {
      button.addEventListener('click', (e) => {
        const previewId = e.currentTarget.getAttribute('data-preview-id');
        const frameType = e.currentTarget.getAttribute('data-frame-type');
        const orientation = e.currentTarget.getAttribute('data-orientation');
        const noFrame = e.currentTarget.getAttribute('data-no-frame') === 'true';
        this.openCamera(previewId, frameType, orientation, noFrame);
      });
    });
    
    // Camera controls
    this.captureBtn.addEventListener('click', () => this.captureImage());
    this.switchBtn.addEventListener('click', () => this.switchCamera());
    this.galleryBtn.addEventListener('click', () => this.galleryInput.click());
    this.closeBtn.addEventListener('click', () => this.closeCamera());
    
    // Gallery input change
    this.galleryInput.addEventListener('change', (e) => this.handleGallerySelect(e));
    
    // Close modal when clicking outside
    this.cameraModal.addEventListener('click', (e) => {
      if (e.target === this.cameraModal) {
        this.closeCamera();
      }
    });
    
    // Handle window resize
    window.addEventListener('resize', () => {
      if (this.cameraModal.style.display === 'flex') {
        this.updateFrameSize();
      }
    });
  }
  
  // Load frame image
  async loadFrame(frameType) {
    // If no frame is needed, return empty string
    if (this.noFrame) {
      return '';
    }
    
    // If frame is already loaded, return it
    if (this.frames[frameType]) {
      return this.frames[frameType];
    }
    
    // Get the frame filename
    const frameFile = this.frameFiles[frameType];
    if (!frameFile) {
      console.error(`Frame type '${frameType}' not found`);
      return ''; // Return empty string instead of null for consistency
    }
    
    // Create a promise to load the image
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Handle CORS if needed
      img.onload = () => {
        this.frames[frameType] = img.src; // Cache the loaded image
        resolve(img.src);
      };
      img.onerror = (error) => {
        console.error(`Error loading frame '${frameFile}':`, error);
        resolve(''); // Return empty string if image fails to load
      };
      
      // Set the image source (relative to the HTML file)
      img.src = `${this.frameBasePath}${frameFile}?${new Date().getTime()}`; // Add timestamp to prevent caching issues
    });
  }
  
  // Open camera with specified frame and orientation
  async openCamera(previewId, frameType, orientation = 'landscape', noFrame = false) {
    try {
      this.currentPreviewId = previewId;
      this.currentFrameType = frameType;
      this.currentOrientation = orientation;
      this.noFrame = noFrame; // Store the noFrame flag
      
      // Show the modal and make it full screen
      document.body.style.overflow = 'hidden';
      this.cameraModal.style.display = 'flex';
      
      // Reset video and frame overlay styles
      this.cameraVideo.style.width = '100%';
      this.cameraVideo.style.height = '100%';
      this.cameraVideo.style.objectFit = 'cover';
      this.frameOverlay.style.maxWidth = '90%';
      this.frameOverlay.style.maxHeight = '90%';
      
      // Update video transform based on current orientation
      this.updateVideoTransform();
      
      // Load and set frame overlay
      const frameSrc = await this.loadFrame(frameType);
      if (frameSrc) {
        this.frameOverlay.src = frameSrc;
        this.frameOverlay.style.display = 'block';
        
        // Adjust frame overlay size based on orientation
        const frameImg = new Image();
        frameImg.onload = () => {
          const isPortrait = orientation === 'portrait';
          
          if (isPortrait) {
            // For portrait, limit by height
            this.frameOverlay.style.maxHeight = '80vh';
            this.frameOverlay.style.width = 'auto';
          } else {
            // For landscape, limit by width
            this.frameOverlay.style.maxWidth = '80vw';
            this.frameOverlay.style.height = 'auto';
          }
        };
        frameImg.src = frameSrc;
      } else {
        this.frameOverlay.style.display = 'none';
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
      this.cameraVideo.srcObject = this.stream;
      this.currentStream = this.stream;
      
      // Enable capture button once video is playing
      this.cameraVideo.onplaying = () => {
        this.captureBtn.disabled = false;
      };
      
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Could not access the camera. Please ensure you have granted camera permissions.');
      this.closeCamera();
    }
  }
  
  // Switch between front and back camera
  async switchCamera() {
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
        this.cameraVideo.srcObject = this.stream;
        this.currentStream = this.stream;
        
        // On iOS, we need to play the video to get the correct orientation
        if (this.isIOS) {
          await this.cameraVideo.play();
        }
      }
    } catch (error) {
      console.error('Error switching camera:', error);
      // Revert the facing mode if there was an error
      this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
    }
  }
  
  // Capture image from video stream
  captureImage() {
    const canvas = document.createElement('canvas');
    const video = this.cameraVideo;
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
    
    // Update preview
    this.updatePreview(this.currentPreviewId, imageDataUrl);
    
    // Close camera
    this.closeCamera();
  }
  
  // Handle image selection from gallery
  handleGallerySelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      this.updatePreview(this.currentPreviewId, e.target.result);
      this.closeCamera();
    };
    reader.readAsDataURL(file);
  }
  
  // Update the preview with the captured/selected image
  updatePreview(previewId, imageData) {
    const previewContainer = document.getElementById(previewId);
    if (!previewContainer) return;
    
    // Clear previous preview
    previewContainer.innerHTML = '';
    
    // Create preview container
    const container = document.createElement('div');
    container.className = 'preview-container';
    
    // Create image element
    const img = document.createElement('img');
    img.src = imageData;
    img.alt = 'Preview';
    img.className = 'img-fluid';
    
    // Create remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-image';
    removeBtn.innerHTML = '×';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.clearPreview(previewId);
    });
    
    // Append elements
    container.appendChild(img);
    container.appendChild(removeBtn);
    previewContainer.appendChild(container);
    
    // Update hidden input
    const inputId = `${previewId}-input`;
    const input = document.getElementById(inputId);
    if (input) {
      input.value = imageData;
    }
  }
  
  // Clear preview
  clearPreview(previewId) {
    const previewContainer = document.getElementById(previewId);
    if (previewContainer) {
      previewContainer.innerHTML = '';
      
      // Clear hidden input
      const inputId = `${previewId}-input`;
      const input = document.getElementById(inputId);
      if (input) {
        input.value = '';
      }
    }
  }
  
  // Close camera and clean up
  closeCamera() {
    try {
      // Stop video stream
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }
      
      // Clear video source
      if (this.cameraVideo.srcObject) {
        this.cameraVideo.srcObject = null;
      }
      
      // Reset frame overlay
      this.frameOverlay.src = '';
      this.frameOverlay.style.display = 'none';
      
      // Hide modal and restore body scroll
      this.cameraModal.style.display = 'none';
      document.body.style.overflow = '';
      
      // Reset capture button state
      this.captureBtn.disabled = true;
      
      // Clear gallery input
      this.galleryInput.value = '';
      
      // Reset current states
      this.currentPreviewId = null;
      this.currentFrameType = null;
      this.currentOrientation = null;
    } catch (error) {
      console.error('Error closing camera:', error);
    }
  }
}

// Initialize the camera module when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  window.cameraModule = new CameraModule();
});
