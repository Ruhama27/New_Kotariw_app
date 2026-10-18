from PIL import Image
try:
    path = r"mobile\assets\splash_bg.png"
    img = Image.open(path)
    img = img.convert("RGB")
    img = img.resize((1080, 1920))
    img.save(path, "PNG")
    print("SUCCESS: Image formatted perfectly for Android.")
except Exception as e:
    print("ERROR:", e)
