from PIL import Image
try:
    source_path = r"C:\Users\hp\.gemini\antigravity\brain\d2363c0e-9566-4a93-9460-33463172c52b\kotariw_app_icon_1775392249982.png"
    icon_path = r"mobile\assets\icon.png"
    adaptive_path = r"mobile\assets\adaptive-icon.png"
    
    img = Image.open(source_path)
    img = img.convert("RGB")
    img = img.resize((1024, 1024))
    
    img.save(icon_path, "PNG")
    img.save(adaptive_path, "PNG")
    print("SUCCESS")
except Exception as e:
    print("ERROR:", e)
