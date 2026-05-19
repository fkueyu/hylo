import os
from PIL import Image, ImageDraw, ImageFilter

def make_full_bleed_squircle(input_path, output_path, size=1024, radius=200):
    """
    Creates a full-bleed squircle icon (rounded corners only, no margins or drop-shadow).
    Suitable for web icons and VS Code extension icon.
    """
    im = Image.open(input_path).convert("RGBA")
    # Resize to standard size
    im = im.resize((size, size), Image.Resampling.LANCZOS)
    
    # Create mask
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size, size), radius=radius, fill=255)
    
    # Apply mask
    output = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    output.paste(im, (0, 0), mask=mask)
    
    # Save
    output.save(output_path, "PNG")
    print(f"Created full-bleed squircle icon: {output_path}")

def make_macos_app_icon(input_path, output_path):
    """
    Creates a standard macOS app icon with margins and drop-shadow.
    Suitable as the source file for Tauri icon generator.
    """
    im = Image.open(input_path).convert("RGBA")
    
    # Standard macOS canvas size
    canvas_size = 1024
    content_size = 824
    margin = (canvas_size - content_size) // 2
    logo_content = im.resize((content_size, content_size), Image.Resampling.LANCZOS)
    
    # macOS squircle corner radius (approx 22.3% of content size)
    radius = 184
    mask = Image.new("L", (content_size, content_size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, content_size, content_size), radius=radius, fill=255)
    
    # Apply round corner mask to content
    rounded_logo = Image.new("RGBA", (content_size, content_size), (0, 0, 0, 0))
    rounded_logo.paste(logo_content, (0, 0), mask=mask)
    
    # Create canvas
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    
    # Create drop shadow
    shadow_mask = Image.new("L", (canvas_size, canvas_size), 0)
    shadow_draw = ImageDraw.Draw(shadow_mask)
    shadow_draw.rounded_rectangle(
        (margin - 2, margin + 8, margin + content_size + 2, margin + content_size + 14), 
        radius=radius + 2, 
        fill=100
    )
    shadow_layer = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 255))
    shadow_blurred = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    shadow_blurred.paste(shadow_layer, (0, 0), mask=shadow_mask)
    shadow_blurred = shadow_blurred.filter(ImageFilter.GaussianBlur(16))
    
    # Composite shadow and logo content
    canvas.paste(shadow_blurred, (0, 0), mask=shadow_blurred.split()[3])
    canvas.paste(rounded_logo, (margin, margin), mask=rounded_logo.split()[3])
    
    # Save
    canvas.save(output_path, "PNG")
    print(f"Created macOS app icon with shadow: {output_path}")

if __name__ == "__main__":
    # Base paths
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dark_src = os.path.join(base_dir, "icon-dark.png")
    light_src = os.path.join(base_dir, "icon-light.png")
    
    # Output targets
    # 1. Web icons
    web_dir = os.path.join(os.path.dirname(base_dir), "web", "public", "hylo")
    os.makedirs(web_dir, exist_ok=True)
    web_dark_dst = os.path.join(web_dir, "icon-dark.png")
    web_light_dst = os.path.join(web_dir, "icon-light.png")
    
    # 2. VS Code extension icon
    vscode_dir = os.path.join(os.path.dirname(base_dir), "hylo-vscode")
    vscode_dst = os.path.join(vscode_dir, "icon.png")
    
    # 3. macOS App Icon Source (used to feed tauri icon generator)
    # We will use the dark icon as the main app icon
    tauri_src_icon = os.path.join(base_dir, "tauri-src-icon.png")
    
    # 4. App UI logo files (squircle)
    app_public_logo = os.path.join(base_dir, "public", "logo.png")
    app_root_squircle = os.path.join(base_dir, "logo_squircle.png")
    
    # Process icons
    # A. Web icons (full-bleed squircles)
    make_full_bleed_squircle(dark_src, web_dark_dst)
    make_full_bleed_squircle(light_src, web_light_dst)
    
    # B. VS Code icon (full-bleed squircle, using the dark icon as requested)
    make_full_bleed_squircle(dark_src, vscode_dst)
    
    # C. macOS App Icon Source (with shadow and margins)
    make_macos_app_icon(dark_src, tauri_src_icon)
    
    # D. App UI logos (full-bleed squircles using dark icon)
    make_full_bleed_squircle(dark_src, app_public_logo)
    make_full_bleed_squircle(dark_src, app_root_squircle)
    
    print("All icons successfully generated!")
