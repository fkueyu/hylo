import sys
from PIL import Image, ImageDraw, ImageFilter

def make_macos_icon(input_path, output_path):
    # 1. 打开原始 Logo 图像，强制转换为 RGBA
    im = Image.open(input_path).convert("RGBA")
    
    # 2. 统一缩放到 1024x1024（标准 macOS 图标设计尺寸）
    im = im.resize((1024, 1024), Image.Resampling.LANCZOS)
    
    # 3. 按照 macOS 规范，主体图标占比约 80% (824x824)，留出 100 像素四周间距用作投影和呼吸感
    content_size = 824
    margin = (1024 - content_size) // 2
    logo_content = im.resize((content_size, content_size), Image.Resampling.LANCZOS)
    
    # 4. 创建圆角遮罩 (macOS Squircle 标准圆角比例约 22.3%，对于 824 尺寸约 184 像素圆角)
    radius = 184
    mask = Image.new("L", (content_size, content_size), 0)
    draw = ImageDraw.Draw(mask)
    
    # 绘制带圆角的白底矩形作为遮罩
    draw.rounded_rectangle((0, 0, content_size, content_size), radius=radius, fill=255)
    
    # 将圆角应用到 Logo 主体
    rounded_logo = Image.new("RGBA", (content_size, content_size), (0, 0, 0, 0))
    rounded_logo.paste(logo_content, (0, 0), mask=mask)
    
    # 5. 创建 1024x1024 的全新透明底画布
    canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    
    # 6. 为圆角图标添加丝滑的 macOS 风格阴影
    shadow_mask = Image.new("L", (1024, 1024), 0)
    shadow_draw = ImageDraw.Draw(shadow_mask)
    # 在阴影层绘制稍大的圆角矩形，略微向下偏移偏移
    shadow_draw.rounded_rectangle(
        (margin - 2, margin + 8, margin + content_size + 2, margin + content_size + 14), 
        radius=radius + 2, 
        fill=100 # 半透明阴影底
    )
    # 高斯模糊渲染阴影
    shadow_layer = Image.new("RGBA", (1024, 1024), (0, 0, 0, 255))
    shadow_blurred = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    shadow_blurred.paste(shadow_layer, (0, 0), mask=shadow_mask)
    shadow_blurred = shadow_blurred.filter(ImageFilter.GaussianBlur(16))
    
    # 7. 合成：底图 -> 阴影 -> 圆角 Logo
    canvas.paste(shadow_blurred, (0, 0), mask=shadow_blurred.split()[3])
    canvas.paste(rounded_logo, (margin, margin), mask=rounded_logo.split()[3])
    
    # 8. 保存处理好的 PNG
    canvas.save(output_path, "PNG")
    print("Successfully crafted macOS squircle icon with drop-shadow!")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 process_logo.py <input> <output>")
        sys.exit(1)
    make_macos_icon(sys.argv[1], sys.argv[2])
