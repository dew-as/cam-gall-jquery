# Camera Module Integration Guide

## Overview
This document explains how to integrate the `camera-module.js` into a Laravel application, including file handling and storage.

## Table of Contents
1. [Installation](#installation)
2. [Setup](#setup)
3. [Usage](#usage)
4. [No-Frame Feature](#no-frame-feature)
5. [Example Workflow](#example-workflow)
6. [Server-Side Handling](#server-side-handling)
7. [Troubleshooting](#troubleshooting)

## Installation

1. Copy these files to your Laravel project:
   - `camera-module.js` → `public/js/camera-module.js`
   - `combinedCamara.html` → `resources/views/vehicle/inspection.blade.php` (or your preferred view)
   - Frame images to `public/images/frames/`

2. Include the required assets in your main layout:

```html
<!-- In resources/views/layouts/app.blade.php -->
<!DOCTYPE html>
<html>
<head>
    <!-- Existing head content -->
    @stack('styles')
</head>
<body>
    @yield('content')
    
    <!-- Scripts -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    @stack('scripts')
</body>
</html>
```

## Setup

1. Update the camera module initialization in your Blade view:

```html
<!-- resources/views/vehicle/inspection.blade.php -->
@extends('layouts.app')

@section('content')
<div class="container">
    <!-- Your existing camera interface -->
</div>

@push('styles')
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css">
<style>
    /* Your existing styles */
</style>
@endpush

@push('scripts')
<script>
    document.addEventListener('DOMContentLoaded', () => {
        window.cameraModule = new CameraModule();
        
        // Set the base path for frame images
        window.cameraModule.frameBasePath = '{{ asset('images/frames/') }}/';
    });
</script>
<script src="{{ asset('js/camera-module.js') }}"></script>
@endpush
@endsection
```

## Usage

### 1. Initialize the Camera Module

```javascript
// In your Blade view
const cameraModule = new CameraModule();
```

### 2. Available Methods

- `openCamera(previewId, frameType, orientation)` - Opens the camera with specified frame
  - `previewId`: ID of the preview container
  - `frameType`: Type of frame to use (e.g., 'car-frame', 'car-frame-side')
  - `orientation`: 'portrait' or 'landscape' (default)

- `closeCamera()` - Closes the camera and cleans up resources

- `switchCamera()` - Toggles between front and back cameras

### 3. HTML Structure

#### Standard Camera with Frame
```html
<!-- Camera Trigger Button with Frame -->
<button class="btn btn-primary camera-trigger" 
        data-preview-id="frontView"
        data-frame-type="car-frame"
        data-orientation="landscape"
        data-no-frame="false">
    <i class="bi bi-camera me-2"></i>Take Photo with Frame
</button>
```

#### Camera without Frame
```html
<!-- Camera Trigger Button without Frame -->
<button class="btn btn-primary camera-trigger" 
        data-preview-id="noFrameTest"
        data-frame-type="no-frame"
        data-orientation="landscape"
        data-no-frame="true">
    <i class="bi bi-camera me-2"></i>Take Photo (No Frame)
</button>
```

<!-- Hidden input to store the image -->
<input type="hidden" name="front_image" id="frontView-input">

<!-- Preview Container -->
<div id="frontView" class="mb-3"></div>
```

## No-Frame Feature

The camera module supports taking photos without any frame overlay, which is useful for general photography needs within your application.

### How It Works

1. **Enable No-Frame Mode**:
   - Set `data-no-frame="true"` on the camera trigger button
   - The camera will open without any frame overlay
   - The captured image will be displayed in the preview container as usual

2. **Implementation Example**:
   ```html
   <div class="col-md-6 mb-4">
       <div class="card h-100">
           <div class="card-body text-center">
               <h5 class="card-title">General Photo</h5>
               <div class="camera-section">
                   <div id="generalPhoto" class="mb-3">
                       <!-- Preview will appear here -->
                   </div>
                   <button class="btn btn-primary camera-trigger" 
                           data-preview-id="generalPhoto"
                           data-frame-type="general"
                           data-orientation="landscape"
                           data-no-frame="true">
                       <i class="bi bi-camera me-2"></i>Take General Photo
                   </button>
                   <input type="hidden" id="generalPhoto-input" name="general_photo">
               </div>
           </div>
       </div>
   </div>
   ```

### When to Use No-Frame Mode
- When you need general photography without specific framing requirements
- For capturing documents, receipts, or other non-vehicle related images
- When the subject doesn't require alignment guides
- For maximum flexibility in image composition

## Example Workflow

### 1. Create a Migration

```bash
php artisan make:migration create_vehicle_inspections_table
```

```php
// database/migrations/YYYY_MM_DD_create_vehicle_inspections_table.php
public function up()
{
    Schema::create('vehicle_inspections', function (Blueprint $table) {
        $table->id();
        $table->string('front_image_path')->nullable();
        $table->string('back_image_path')->nullable();
        $table->string('left_side_image_path')->nullable();
        $table->string('right_side_image_path')->nullable();
        $table->timestamps();
    });
}
```

### 2. Create a Model

```bash
php artisan make:model VehicleInspection
```

### 3. Create a Controller

```bash
php artisan make:controller VehicleInspectionController --resource
```

```php
// app/Http/Controllers/VehicleInspectionController.php
namespace App\Http\Controllers;

use App\Models\VehicleInspection;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class VehicleInspectionController extends Controller
{
    public function create()
    {
        return view('vehicle.inspection');
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'front_image' => 'required|string',
            'back_image' => 'required|string',
            'left_image' => 'required|string',
            'right_image' => 'required|string',
        ]);

        $inspection = new VehicleInspection();
        
        // Process and store each image
        $imageFields = ['front_image', 'back_image', 'left_image', 'right_image'];
        
        foreach ($imageFields as $field) {
            if ($request->filled($field)) {
                $imageData = $request->input($field);
                $imagePath = $this->storeBase64Image($imageData, 'inspections/' . $field . '_' . time() . '.jpg');
                $inspection->{$field . '_path'} = $imagePath;
            }
        }
        
        $inspection->save();
        
        return redirect()->route('inspections.show', $inspection)
                         ->with('success', 'Inspection completed successfully!');
    }
    
    protected function storeBase64Image($base64Image, $path)
    {
        // Remove the data URL prefix
        $image = str_replace('data:image/jpeg;base64,', '', $base64Image);
        $image = str_replace(' ', '+', $image);
        $imageData = base64_decode($image);
        
        // Store the file
        Storage::disk('public')->put($path, $imageData);
        
        return $path;
    }
}
```

### 4. Create Routes

```php
// routes/web.php
use App\Http\Controllers\VehicleInspectionController;

Route::get('/inspections/create', [VehicleInspectionController::class, 'create'])->name('inspections.create');
Route::post('/inspections', [VehicleInspectionController::class, 'store'])->name('inspections.store');
```

### 5. Displaying Stored Images

```php
// In your Blade view
@if($inspection->front_image_path)
    <img src="{{ Storage::url($inspection->front_image_path) }}" alt="Front View" class="img-fluid">
@endif
```

## Server-Side Handling

### 1. File System Configuration

Make sure your filesystem is properly configured in `config/filesystems.php`:

```php
'disks' => [
    'public' => [
        'driver' => 'local',
        'root' => storage_path('app/public'),
        'url' => env('APP_URL').'/storage',
        'visibility' => 'public',
    ],
    // ...
],
```

### 2. Create Storage Link

```bash
php artisan storage:link
```

## Troubleshooting

1. **Camera Not Working**
   - Ensure you're using HTTPS in production (required for camera access)
   - Check browser console for errors
   - Verify camera permissions are granted

2. **Image Upload Fails**
   - Check storage permissions: `storage` and `bootstrap/cache` should be writable
   - Verify the storage link is created
   - Check PHP's `upload_max_filesize` and `post_max_size` in php.ini

3. **Orientation Issues**
   - Clear browser cache if orientation changes aren't detected
   - Test on multiple devices as behavior may vary

4. **Mobile-Specific Issues**
   - On iOS, camera access requires a user gesture (e.g., button click)
   - Some Android devices may have different aspect ratio behaviors

## Security Considerations

1. Always validate and sanitize image data on the server
2. Implement proper file type validation
3. Consider adding file size limits
4. Implement CSRF protection for your forms

## License

This camera module is open-sourced software licensed under the [MIT license](https://opensource.org/licenses/MIT).

## Prerequisites
- Laravel application
- Bootstrap 5
- Bootstrap Icons

## File Structure
```
resources/
  views/
    vehicles/
      create.blade.php  # Your blade template
public/
  js/
    camera-module.js    # The camera module
```

## Integration Steps

### 1. Include Required Assets
In your blade template's `<head>` section:

```html
<!-- In resources/views/vehicles/create.blade.php -->
<head>
    <!-- Bootstrap CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css">
    
    <!-- Camera Module CSS (copy from combinedCamara.html) -->
    <style>
        /* Copy all the CSS from combinedCamara.html */
    </style>
</head>
```

### 2. Create Camera Input Sections
For each camera input you need:

```html
<div class="col-md-6 mb-4">
    <div class="card h-100">
        <div class="card-body text-center">
            <h5 class="card-title">Front View</h5>
            <div class="camera-section">
                <div id="frontView" class="mb-3">
                    <!-- Preview will appear here -->
                </div>
                <button class="btn btn-primary camera-trigger" 
                        data-preview-id="frontView"
                        data-frame-type="car-frame"
                        data-orientation="landscape">
                    <i class="bi bi-camera me-2"></i>Take Photo
                </button>
                <input type="hidden" id="frontView-input" name="front_image">
            </div>
        </div>
    </div>
</div>
```

### 3. Add Camera Modal
Place this before the closing `</body>` tag:

```html
<!-- Camera Modal -->
<div id="cameraModal" class="camera-modal">
    <div class="camera-content">
        <div class="camera-preview">
            <video id="cameraVideo" autoplay playsinline></video>
            <img id="frameOverlay" src="" alt="Frame Overlay" style="display:none;">
        </div>
        <div class="camera-controls">
            <button id="switchCamera" class="btn btn-sm btn-light" title="Switch Camera">
                <i class="bi bi-camera-reverse"></i>
            </button>
            <button id="captureBtn" class="btn btn-primary btn-circle" title="Take Photo">
                <i class="bi bi-camera"></i>
            </button>
            <button id="galleryBtn" class="btn btn-sm btn-light" title="Choose from Gallery">
                <i class="bi bi-images"></i>
                <input type="file" id="galleryInput" accept="image/*" style="display:none;">
            </button>
        </div>
        <button id="closeCamera" class="btn-close btn-close-white" aria-label="Close"></button>
    </div>
</div>
```

### 4. Include JavaScript
Before the closing `</body>` tag:

```html
<!-- Bootstrap JS -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>

<!-- Camera Module -->
<script src="{{ asset('js/camera-module.js') }}"></script>
```

## Workflow Explanation

1. **Initialization**:
   - When the page loads, the `CameraModule` class is instantiated automatically
   - Event listeners are set up for all elements with the `camera-trigger` class

2. **Taking a Photo**:
   - User clicks a "Take Photo" button
   - The camera modal opens with the appropriate frame overlay
   - User can:
     - Take a photo using the camera
     - Switch between front/back cameras
     - Choose an image from the gallery
   - Captured/selected image appears in the preview

3. **Data Flow**:
   - Each image is stored as a base64 string in a hidden input field
   - The input field's name corresponds to the view (e.g., `front_image`)
   - When the form is submitted, these values are sent to the server

4. **Server-Side Handling**:
   ```php
   public function store(Request $request)
   {
       $frontImage = $request->input('front_image');
       // Process other images similarly
       
       // Convert base64 to file if needed
       if ($frontImage) {
           $image = base64_decode(preg_replace('#^data:image/\\w+;base64,#i', '', $frontImage));
           // Save the file
       }
   }
   ```

## Customization Options

1. **Frames**:
   - Add new frames by adding entries to the `frames` object in `camera-module.js`
   - Supported frame types: 'car-frame', 'car-frame-rotate', 'car-frame-side'

2. **Styling**:
   - Modify the CSS in the `<style>` section to match your application's design
   - Adjust the modal size, colors, and layout as needed

3. **Validation**:
   - Add client-side validation to ensure required photos are taken
   - Add server-side validation to verify image data

## Best Practices

1. **Error Handling**:
   - The module includes basic error handling for camera access
   - Add additional error handling as needed for your application

2. **Performance**:
   - For production, consider resizing images before upload
   - The module already compresses images to JPEG with 0.9 quality

3. **Security**:
   - Always validate image data on the server side
   - Consider implementing file size limits
   - Sanitize any user input

## Troubleshooting

1. **Camera Not Working**:
   - Ensure you're using HTTPS (required for camera access)
   - Check browser console for errors
   - Verify camera permissions are granted

2. **Images Not Displaying**:
   - Check the browser console for any JavaScript errors
   - Verify that the base64 image data is properly formatted

3. **Layout Issues**:
   - Ensure all required CSS is included
   - Check for conflicting styles in your application
