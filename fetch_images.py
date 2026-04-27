import urllib.request
import urllib.parse
import json
import re

# Download App Icon from Wikipedia
try:
    url = "https://en.wikipedia.org/w/api.php?action=query&titles=Pok%C3%A9mon_Trading_Card_Game_Pocket&prop=pageimages&format=json&pithumbsize=800"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    response = urllib.request.urlopen(req)
    data = json.loads(response.read())
    pages = data['query']['pages']
    page_id = list(pages.keys())[0]
    img_url = pages[page_id]['thumbnail']['source']
    
    req_img = urllib.request.Request(img_url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req_img) as resp:
        with open('public/card_mockup.png', 'wb') as f:
            f.write(resp.read())
    print("Icon downloaded from Wikipedia:", img_url)
except Exception as e:
    print("Failed to download icon:", e)

# Download Banner via DuckDuckGo HTML Search
try:
    search_term = urllib.parse.quote("Pokemon Trading Card Game Pocket official wallpaper art")
    search_url = f"https://html.duckduckgo.com/html/?q={search_term}"
    req = urllib.request.Request(search_url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'})
    html = urllib.request.urlopen(req).read().decode('utf-8')
    
    # Extract the first image thumbnail url
    match = re.search(r'//external-content\.duckduckgo\.com/iu/\?u=([^&\"\'\s]+)', html)
    if match:
        img_url = urllib.parse.unquote(match.group(1))
        print("Found banner image on DDG:", img_url)
        
        req_img = urllib.request.Request(img_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req_img) as resp:
            with open('public/hero_banner.png', 'wb') as f:
                f.write(resp.read())
        print("Banner downloaded successfully")
    else:
        print("No image found in DDG HTML")
except Exception as e:
    print("Failed to download banner:", e)
