"""Fill the local database with realistic demo data for analytics and ML.

Run from backend directory:
    python -m app.demo_seed

Run again with a clean demo reset:
    python -m app.demo_seed --reset
"""

from __future__ import annotations

import argparse
import hashlib
import random
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from urllib.parse import unquote, urlparse

from sqlalchemy import func

from . import models
from .auth import get_password_hash
from .bootstrap import ensure_schema_updates
from .database import SessionLocal, engine
from .seed import seed_reference_data

RANDOM_SEED = 20260425
DEMO_DOMAIN = "demo.travel"
DEMO_PASSWORD = "demo12345"

TOUR_IMAGES = {
    "Лондон": "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1400&q=80",
    "Казань": "https://images.unsplash.com/photo-1543783207-ec64e4d95325?auto=format&fit=crop&w=1400&q=80",
    "Сочи": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=80",
    "Санкт-Петербург": "https://images.unsplash.com/photo-1556610961-2fecc5927173?auto=format&fit=crop&w=1400&q=80",
    "Дубай": "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1400&q=80",
    "Стамбул": "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=1400&q=80",
    "Анталья": "https://images.unsplash.com/photo-1602002418082-a4443e081dd1?auto=format&fit=crop&w=1400&q=80",
    "Рим": "https://images.unsplash.com/photo-1529260830199-42c24126f198?auto=format&fit=crop&w=1400&q=80",
    "Шарм-эль-Шейх": "https://images.unsplash.com/photo-1572252009286-268acec5ca0a?auto=format&fit=crop&w=1400&q=80",
    "Москва": "https://images.unsplash.com/photo-1513326738677-b964603b136d?auto=format&fit=crop&w=1400&q=80",
    "Каппадокия": "https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=1400&q=80",
    "Абу-Даби": "https://images.unsplash.com/photo-1512632578888-169bbbc64f33?auto=format&fit=crop&w=1400&q=80",
    "Шарджа": "https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=1400&q=80",
    "Каир": "https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?auto=format&fit=crop&w=1400&q=80",
    "Хургада": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=80",
    "Венеция": "https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?auto=format&fit=crop&w=1400&q=80",
    "Флоренция": "https://images.unsplash.com/photo-1541370976299-4d24ebbc9077?auto=format&fit=crop&w=1400&q=80",
    "Эдинбург": "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?auto=format&fit=crop&w=1400&q=80",
    "Манчестер": "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1400&q=80",
}


def _wikimedia_thumbnail_url(image_url: str, width: int = 960) -> str:
    commons_marker = "/wikipedia/commons/"
    if (
        not image_url.startswith("https://upload.wikimedia.org")
        or commons_marker not in image_url
        or "/thumb/" in image_url
    ):
        return image_url

    prefix, filename = image_url.rsplit("/", 1)
    thumbnail_prefix = prefix.replace(commons_marker, "/wikipedia/commons/thumb/", 1)
    return f"{thumbnail_prefix}/{filename}/{width}px-{filename}"


CITY_IMAGE_SOURCE_SETS = {
    "Москва": [
        "https://upload.wikimedia.org/wikipedia/commons/8/85/Saint_Basil%27s_Cathedral_and_the_Red_Square.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/e/ee/Kremlin_and_Red_Square.1.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/d/d1/Moscow-City_2025.jpg",
    ],
    "Санкт-Петербург": [
        "https://upload.wikimedia.org/wikipedia/commons/4/41/Spb_06-2017_img20_StMichael_Castle_%28cropped%29.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/1/16/5174-3._St._Petersburg._Greater_Hermitage.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/3/36/Peterhof_Palace%2C_Saint_Petersburg%2C_Russia_%2844408938295%29.jpg",
    ],
    "Сочи": [
        "https://upload.wikimedia.org/wikipedia/commons/f/f5/Sochi_harbour.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/4/47/RosaSki3.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/e/ee/Sochi_adler_aerial_view_2018_14.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/c/c7/Sochi_Beach_arbour.jpg",
    ],
    "Казань": [
        "https://upload.wikimedia.org/wikipedia/commons/b/bd/%D0%94%D0%B2%D0%BE%D1%80%D0%B5%D1%86_%D0%B7%D0%B5%D0%BC%D0%BB%D0%B5%D0%B4%D0%B5%D0%BB%D1%8C%D1%86%D0%B5%D0%B22.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/b/b3/%D0%9A%D0%B0%D0%B7%D0%B0%D0%BD%D1%81%D0%BA%D0%B8%D0%B9_%D0%BA%D1%80%D0%B5%D0%BC%D0%BB%D1%8C._%D0%9F%D0%B0%D0%BD%D0%BE%D1%80%D0%B0%D0%BC%D0%B0_%D1%81_%D0%BA%D0%BE%D0%BB%D0%B5%D1%81%D0%B0_%D0%BE%D0%B1%D0%BE%D0%B7%D1%80%D0%B5%D0%BD%D0%B8%D1%8F.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/8/8c/Baumana_Street_Kazan_Russia_2009_sept_06.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/7/74/02021_0712_Lipka-Tatar_cuisine_in_Poland.jpg",
    ],
    "Стамбул": [
        "https://upload.wikimedia.org/wikipedia/commons/c/cb/Historical_peninsula_and_modern_skyline_of_Istanbul.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/4/4a/Hagia_Sophia_%28228968325%29.jpeg",
        "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=1400&q=82",
    ],
    "Анталья": [
        "https://upload.wikimedia.org/wikipedia/commons/7/73/Falezlerden_Antalya_Konyaalt%C4%B1_Plaj%C4%B1na_do%C4%9Fru_bir_g%C3%B6r%C3%BCn%C3%BCm.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/6/63/Antalya_Kalei%C3%A7i.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/d/d0/Kalei%C3%A7i_Old_Town%2C_Antalya%2C_Turkey_2022_-_Mekan_M%C3%BCdavim.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/4/40/Kalei%C3%A7i_Old_Town%2C_Antalya%2C_Turkey_26_Feb_2022.jpg",
    ],
    "Каппадокия": [
        "https://upload.wikimedia.org/wikipedia/commons/5/59/Cappadocia_balloon_trip%2C_Ortahisar_Castle_%2811893715185%29.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/d/dc/Derinkuyu_Underground_City_9843_Nevit_Enhancer.jpg",
        "https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=1400&q=82",
    ],
    "Дубай": [
        "https://upload.wikimedia.org/wikipedia/en/c/c7/Burj_Khalifa_2021.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/9/90/Burj_Khalifa_%28worlds_tallest_building%29_and_the_Dubai_skyline_%2825781049892%29.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/e/e6/Dubai_Marina_Skyline.jpg",
    ],
    "Абу-Даби": [
        "https://upload.wikimedia.org/wikipedia/commons/9/9c/Abu_dhabi_skylines_2014.jpg",
        "https://upload.wikimedia.org/wikipedia/en/7/7d/Sheikh_Zayed_Mosque_view.jpg",
        "https://upload.wikimedia.org/wikipedia/en/5/55/LouvreAD_exterior.jpg",
    ],
    "Шарджа": [
        "https://upload.wikimedia.org/wikipedia/commons/b/b7/Al_Qasba.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/b/bf/Sharjah_Museum_of_Islamic_Civilisation_north-west_facade_%2822025908913%29.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/4/44/Al-Majaz_Waterfront_water_spouts.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/8/8d/Al_Majaz_Waterfront%2C_Sharjah_UAE.jpg",
    ],
    "Шарм-эль-Шейх": [
        "https://upload.wikimedia.org/wikipedia/commons/a/ac/Sharm_El_Sheikh_-_panoramio_%2815%29.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/9/9a/Coral_%28Acropora_hemprichii%29%2C_Ras_Katy%2C_Sharm_el-Sheij%2C_Egipto%2C_2022-03-26%2C_DD_108.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/f/f8/Coral_%28Acropora_hemprichii%29%2C_Ras_Katy%2C_Sharm_el-Sheij%2C_Egipto%2C_2022-03-26%2C_DD_87.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/2/28/%D8%A8%D9%88%D8%A7%D8%A8%D8%A7%D8%AA_%D9%85%D8%AD%D9%85%D9%8A%D9%87_%D8%B1%D8%A7%D8%B3_%D9%85%D8%AD%D9%85%D8%AF.png",
    ],
    "Каир": [
        "https://upload.wikimedia.org/wikipedia/commons/7/72/Cairo_Opera_House%2C_Al_Hurriyah_Park_and_the_Nile_river_%2814797782354%29.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/9/96/Pyramids_of_the_Giza_Necropolis.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/3/33/1897_bis_1902_wurde_das_%C3%84gyptische_Museum_in_Kairo_gebaut._04.jpg",
    ],
    "Хургада": [
        "https://upload.wikimedia.org/wikipedia/commons/d/d6/Hurghada_Hotels_R03.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/e/ec/Giftun_Soraya01.JPG",
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=82",
    ],
    "Рим": [
        "https://upload.wikimedia.org/wikipedia/commons/7/7e/Trevi_Fountain%2C_Rome%2C_Italy_2_-_May_2007.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/d/de/Colosseo_2020.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/d/de/Santa_Maria_in_Trastevere_fountain.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/9/92/Basilica_Sancti_Petri_blue_hour.jpg",
    ],
    "Венеция": [
        "https://upload.wikimedia.org/wikipedia/commons/4/4f/Venezia_aerial_view.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/5/51/View_of_the_Grand_Canal_from_Rialto_to_Ca%27Foscari.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/1/17/Piazza_San_Marco_%28Venice%29_at_night-msu-2021-6449-.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/b/bb/Murano_sunset.JPG",
    ],
    "Флоренция": [
        "https://upload.wikimedia.org/wikipedia/commons/d/d2/FirenzeDec092023_01.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/c/c7/Cattedrale_di_Santa_Maria_del_Fiore_%E2%80%93_Il_Duomo_di_Firenze.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/d/d7/Florence%2C_Italy_-_panoramio_%28125%29.jpg",
    ],
    "Лондон": [
        "https://upload.wikimedia.org/wikipedia/commons/6/67/London_Skyline_%28125508655%29.jpeg",
        "https://upload.wikimedia.org/wikipedia/commons/4/43/Elizabeth_Tower%2C_June_2022.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/8/86/British_Museum_%28aerial%29.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/e/ec/Tower_of_London_from_the_Shard_%288515883950%29.jpg",
    ],
    "Эдинбург": [
        "https://upload.wikimedia.org/wikipedia/commons/1/1a/Skyline_of_Edinburgh.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/5/59/City_of_Edinburgh_-_Edinburgh_Castle_-_20140421004403.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/8/8d/High_Street%2C_Edinburgh.JPG",
        "https://upload.wikimedia.org/wikipedia/commons/0/0f/Arthur%27s_Seat%2C_Edinburgh.JPG",
    ],
    "Манчестер": [
        "https://upload.wikimedia.org/wikipedia/commons/8/8c/Tower_Blocks_over_Knott_Mill%2C_geograph_6866152_by_David_Dixon.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/1/1a/2023_07_31_arne_mueseler_00060-Verbessert-RR_%2853106651455%29.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/a/a1/Science_and_Industry_Museum.jpg",
    ],
    "Денпасар": [
        "https://upload.wikimedia.org/wikipedia/commons/8/8d/TanahLot_2014.JPG",
        "https://upload.wikimedia.org/wikipedia/commons/5/5d/Ubud_%2849818456887%29.jpg",
        "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1400&q=82",
    ],
    "Нью-Йорк": [
        "https://upload.wikimedia.org/wikipedia/commons/7/7a/View_of_Empire_State_Building_from_Rockefeller_Center_New_York_City_dllu_%28cropped%29.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/4/47/New_york_times_square-terabass.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/8/89/Front_view_of_Statue_of_Liberty_%28cropped%29.jpg",
    ],
    "Париж": [
        "https://upload.wikimedia.org/wikipedia/commons/4/4b/La_Tour_Eiffel_vue_de_la_Tour_Saint-Jacques%2C_Paris_ao%C3%BBt_2014_%282%29.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/8/85/Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/6/66/Louvre_Museum_Wikimedia_Commons.jpg",
    ],
    "Токио": [
        "https://upload.wikimedia.org/wikipedia/commons/b/b2/Skyscrapers_of_Shinjuku_2009_January.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/5/58/Tokyo_Tower_2023.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/8/88/Shibuya_Crossing%2C_Aerial.jpg",
    ],
    "Киото": [
        "https://upload.wikimedia.org/wikipedia/commons/3/3c/Kiyomizu.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/0/0e/Torii_path_with_lantern_at_Fushimi_Inari_Taisha_Shrine%2C_Kyoto%2C_Japan.jpg",
    ],
}

CITY_IMAGE_SOURCE_SETS = {
    city: [_wikimedia_thumbnail_url(image_url) for image_url in image_urls]
    for city, image_urls in CITY_IMAGE_SOURCE_SETS.items()
}

CITY_EVENT_IMAGE_INDEXES = {
    "Москва": (("красн", 1), ("кремл", 1), ("москва-сити", 2), ("панорам", 2)),
    "Санкт-Петербург": (("эрмитаж", 1), ("музей", 1), ("петергоф", 2), ("фонтан", 2)),
    "Сочи": (("красная поляна", 1), ("олимп", 2), ("мор", 3), ("набереж", 3)),
    "Казань": (("кремл", 1), ("бауман", 2), ("гастроном", 3)),
    "Стамбул": (("айя", 1), ("соф", 1), ("босфор", 2), ("галат", 2)),
    "Анталья": (("пляж", 0), ("мор", 0), ("калеич", 1), ("старый город", 2)),
    "Каппадокия": (("шар", 0), ("долин", 0), ("подзем", 1)),
    "Дубай": (("бурдж", 1), ("архитект", 1), ("марина", 2)),
    "Абу-Даби": (("мечет", 1), ("лувр", 2)),
    "Шарджа": (("музей", 1), ("маджаз", 2), ("набереж", 3)),
    "Шарм-эль-Шейх": (("сноркл", 1), ("риф", 2), ("рас-мохаммед", 3)),
    "Каир": (("пирамид", 1), ("гиз", 1), ("музей", 2)),
    "Хургада": (("гифтун", 1), ("мор", 1), ("пляж", 2)),
    "Рим": (("колиз", 1), ("трастевер", 2), ("ватикан", 3), ("петра", 3)),
    "Венеция": (("гранд", 1), ("сан-марко", 2), ("мурано", 3), ("бурано", 3)),
    "Флоренция": (("собор", 1), ("дуом", 1), ("уффици", 2)),
    "Лондон": (("вестминстер", 1), ("биг-бен", 1), ("британский музей", 2), ("тауэр", 3)),
    "Эдинбург": (("замок", 1), ("королев", 2), ("миля", 2), ("артурс", 3)),
    "Манчестер": (("стадион", 1), ("футбол", 1), ("музей", 2), ("науч", 2)),
    "Денпасар": (("храм", 0), ("убуд", 1)),
    "Нью-Йорк": (("таймс", 1), ("стату", 2), ("свобод", 2)),
    "Париж": (("эйфел", 1), ("лувр", 2)),
    "Токио": (("башн", 1), ("сибу", 2), ("shibuya", 2)),
    "Киото": (("фусими", 1), ("инари", 1)),
}

GENERAL_EVENT_IMAGE_SOURCES = (
    ("бюджет", "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1400&q=82"),
    ("вебинар", "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1400&q=82"),
    ("бронир", "https://images.unsplash.com/photo-1486911278844-a81c5267e227?auto=format&fit=crop&w=1400&q=82"),
)

SEMANTIC_MEDIA_DIR = Path(__file__).resolve().parents[1] / "storage" / "media" / "tour-catalog"


def semantic_media_path(source_url: str) -> Path:
    parsed = urlparse(source_url)
    source_name = unquote(Path(parsed.path).name)
    suffix = Path(source_name).suffix.lower()
    if suffix not in {".jpg", ".jpeg", ".png", ".webp"}:
        suffix = ".jpg"
    digest = hashlib.sha256(source_url.encode("utf-8")).hexdigest()[:20]
    return SEMANTIC_MEDIA_DIR / f"{digest}{suffix}"


def semantic_media_url(source_url: str) -> str:
    cached_path = semantic_media_path(source_url)
    if cached_path.exists() and cached_path.stat().st_size > 1024:
        return f"/media/tour-catalog/{cached_path.name}"
    return source_url


def semantic_media_sources() -> list[str]:
    sources = {
        source_url
        for image_urls in CITY_IMAGE_SOURCE_SETS.values()
        for source_url in image_urls
    }
    sources.update(source_url for _, source_url in GENERAL_EVENT_IMAGE_SOURCES)
    return sorted(sources)

MEDIA_IMAGE_POOL = [
    "photo-1513635269975-59663e0ac1ad",
    "photo-1543783207-ec64e4d95325",
    "photo-1507525428034-b723cf961d3e",
    "photo-1556610961-2fecc5927173",
    "photo-1512453979798-5ea266f8880c",
    "photo-1524231757912-21f4fe3a7200",
    "photo-1602002418082-a4443e081dd1",
    "photo-1529260830199-42c24126f198",
    "photo-1572252009286-268acec5ca0a",
    "photo-1513326738677-b964603b136d",
    "photo-1528181304800-259b08848526",
    "photo-1512632578888-169bbbc64f33",
    "photo-1518684079-3c830dcef090",
    "photo-1539650116574-75c0c6d73f6e",
    "photo-1523906834658-6e24ef2386f9",
    "photo-1541370976299-4d24ebbc9077",
    "photo-1506377247377-2a5b3b417ebb",
    "photo-1518005020951-eccb494ad742",
    "photo-1488646953014-85cb44e25828",
    "photo-1498307833015-e7b400441eb8",
    "photo-1502602898657-3e91760cbb34",
    "photo-1503220317375-aaad61436b1b",
    "photo-1516483638261-f4dbaf036963",
    "photo-1537996194471-e657df975ab4",
    "photo-1540959733332-eab4deabeeaf",
    "photo-1496588152823-e7d27d7d5f53",
    "photo-1552664730-d307ca884978",
    "photo-1500530855697-b586d89ba3ee",
    "photo-1476514525535-07fb3b4ae5f1",
    "photo-1469474968028-56623f02e42e",
    "photo-1501785888041-af3ef285b470",
    "photo-1441974231531-c6227db76b6e",
    "photo-1433086966358-54859d0ed716",
    "photo-1472214103451-9374bd1c798e",
    "photo-1439853949127-fa647821eba0",
    "photo-1500534623283-312aade485b7",
    "photo-1428908728789-d2de25dbd4e2",
    "photo-1486911278844-a81c5267e227",
    "photo-1497436072909-f5e4be1713c0",
    "photo-1500534314209-a25ddb2bd429",
    "photo-1470770841072-f978cf4d019e",
    "photo-1464278533981-50106e6176b1",
    "photo-1501854140801-50d01698950b",
    "photo-1447752875215-b2761acb3c5d",
    "photo-1418065460487-3e41a6c84dc5",
    "photo-1493246507139-91e8fad9978e",
    "photo-1482938289607-e9573fc25ebb",
    "photo-1472396961693-142e6e269027",
    "photo-1464822759023-fed622ff2c3b",
    "photo-1523712999610-f77fbcfc3843",
    "photo-1444723121867-7a241cacace9",
    "photo-1480714378408-67cf0d13bc1b",
    "photo-1477959858617-67f85cf4f1df",
    "photo-1511818966892-d7d671e672a2",
    "photo-1514565131-fce0801e5785",
    "photo-1493558103817-58b2924bce98",
    "photo-1500375592092-40eb2168fd21",
    "photo-1505228390874-4a4f59f7a2bf",
    "photo-1504674900247-0877df9cc836",
    "photo-1473448912268-2022ce9509d8",
    "photo-1454496522488-7a8e488e8606",
    "photo-1533104816931-20fa691ff6ca",
    "photo-1467269204594-9661b134dd2b",
    "photo-1548013146-72479768bada",
    "photo-1544986581-efac024faf62",
    "photo-1534351590666-13e3e96b5017",
    "photo-1510414842594-a61c69b5ae57",
]


def unique_media_image(index: int) -> str:
    if index >= len(MEDIA_IMAGE_POOL):
        return f"https://picsum.photos/seed/travel-agency-{index}/1400/900"
    photo_id = MEDIA_IMAGE_POOL[index]
    return f"https://images.unsplash.com/{photo_id}?auto=format&fit=crop&w=1400&q=82"


def city_media_images(city: str) -> list[str]:
    source_images = CITY_IMAGE_SOURCE_SETS.get(city)
    if source_images:
        return [semantic_media_url(source_url) for source_url in source_images]

    legacy_image = TOUR_IMAGES.get(city)
    return [legacy_image] if legacy_image else []


def city_media_image(city: str, variant: int = 0) -> str:
    images = city_media_images(city)
    if images:
        return images[variant % len(images)]
    return unique_media_image(abs(hash(city)) % len(MEDIA_IMAGE_POOL))


def event_media_image(title: str, city: str, variant: int = 0) -> str:
    normalized_title = (title or "").lower()
    if not city:
        for keyword, image_url in GENERAL_EVENT_IMAGE_SOURCES:
            if keyword in normalized_title:
                return semantic_media_url(image_url)
        return unique_media_image(18 + variant)

    for keyword, image_index in CITY_EVENT_IMAGE_INDEXES.get(city, ()):
        if keyword in normalized_title:
            return city_media_image(city, image_index)
    return city_media_image(city, variant + 1)

CITY_EXPERIENCES = {
    "Москва": ["Красная площадь и Кремль", "Москва-Сити и панорамная площадка", "Вечерняя прогулка по центру"],
    "Санкт-Петербург": ["Эрмитаж и Дворцовая площадь", "Петергоф и фонтаны", "Прогулка по рекам и каналам"],
    "Сочи": ["Олимпийский парк", "Красная Поляна", "Набережная и морская прогулка"],
    "Казань": ["Казанский Кремль", "Улица Баумана", "Гастрономическая программа"],
    "Стамбул": ["Султанахмет и Айя-София", "Прогулка по Босфору", "Галата и Истикляль"],
    "Анталья": ["Старый город Калеичи", "Пляжный день", "Водопады Дюден"],
    "Каппадокия": ["Полёт на воздушном шаре", "Долина любви", "Подземный город"],
    "Дубай": ["Бурдж-Халифа", "Дубай Марина", "Сафари в пустыне"],
    "Абу-Даби": ["Мечеть шейха Зайда", "Лувр Абу-Даби", "Набережная Корниш"],
    "Шарджа": ["Музей исламской цивилизации", "Набережная Аль-Маджаз", "Центральный рынок"],
    "Шарм-эль-Шейх": ["Снорклинг у рифов", "Национальный парк Рас-Мохаммед", "Вечер в Наама-Бей"],
    "Каир": ["Пирамиды Гизы", "Египетский музей", "Старый Каир"],
    "Хургада": ["Морская прогулка", "Остров Гифтун", "Сафари по пустыне"],
    "Рим": ["Колизей и Римский форум", "Ватикан и собор Святого Петра", "Трастевере и гастрономия"],
    "Венеция": ["Площадь Сан-Марко", "Гранд-канал", "Острова Мурано и Бурано"],
    "Флоренция": ["Галерея Уффици", "Собор Санта-Мария-дель-Фьоре", "Тосканская гастрономия"],
    "Лондон": ["Вестминстер и Биг-Бен", "Британский музей", "Тауэр и прогулка по Темзе"],
    "Эдинбург": ["Эдинбургский замок", "Королевская миля", "Артурс-Сит"],
    "Манчестер": ["Научно-промышленный музей", "Северный квартал", "Стадион и футбольная история"],
}

COUNTRIES = [
    {"name": "Россия", "code": "RU", "currency": "RUB", "language": "Русский", "timezone": "UTC+3", "visa_required": False, "rating": 4.7},
    {"name": "Турция", "code": "TR", "currency": "TRY", "language": "Турецкий", "timezone": "UTC+3", "visa_required": False, "rating": 4.6},
    {"name": "ОАЭ", "code": "AE", "currency": "AED", "language": "Арабский", "timezone": "UTC+4", "visa_required": False, "rating": 4.8},
    {"name": "Египет", "code": "EG", "currency": "EGP", "language": "Арабский", "timezone": "UTC+2", "visa_required": False, "rating": 4.4},
    {"name": "Италия", "code": "IT", "currency": "EUR", "language": "Итальянский", "timezone": "UTC+1", "visa_required": True, "rating": 4.9},
    {"name": "Великобритания", "code": "GB", "currency": "GBP", "language": "Английский", "timezone": "UTC+0", "visa_required": True, "rating": 4.7},
]

RESORTS = [
    ("Сочи", "Россия", "Морской курорт с пляжами, горами, прогулками и экскурсионной программой."),
    ("Казань", "Россия", "Город для культурных туров, гастрономии и архитектурных маршрутов."),
    ("Санкт-Петербург", "Россия", "Классическое направление для экскурсионных туров, музеев и прогулок по центру."),
    ("Москва", "Россия", "Деловой и культурный центр с насыщенной городской программой."),
    ("Стамбул", "Турция", "Город на стыке Европы и Азии с сильной экскурсионной программой."),
    ("Анталья", "Турция", "Пляжное направление с отелями, питанием и семейным отдыхом."),
    ("Дубай", "ОАЭ", "Премиальное направление с городской инфраструктурой, шопингом и экскурсиями."),
    ("Шарм-эль-Шейх", "Египет", "Курорт Красного моря с пляжным отдыхом, дайвингом и экскурсиями."),
    ("Рим", "Италия", "Исторический город для культурных и гастрономических поездок."),
    ("Лондон", "Великобритания", "Городской тур с музеями, историческими кварталами и обзорными маршрутами."),
    ("Каппадокия", "Турция", "Регион долин, пещерных городов и полётов на воздушных шарах."),
    ("Абу-Даби", "ОАЭ", "Столица с современной архитектурой, музеями и спокойными пляжами."),
    ("Шарджа", "ОАЭ", "Культурный эмират с музеями, рынками и семейной инфраструктурой."),
    ("Каир", "Египет", "Историческая столица рядом с пирамидами Гизы и крупнейшими музеями."),
    ("Хургада", "Египет", "Курорт Красного моря для пляжного отдыха и морских экскурсий."),
    ("Венеция", "Италия", "Город каналов, дворцов и островных маршрутов."),
    ("Флоренция", "Италия", "Центр искусства Ренессанса и гастрономических маршрутов Тосканы."),
    ("Эдинбург", "Великобритания", "Историческая столица Шотландии с замком и панорамными маршрутами."),
    ("Манчестер", "Великобритания", "Современный город музыки, футбола и индустриальной истории."),
]

DEMO_TOURS = [
    {"title": "Сочи: море и горы", "country": "Россия", "city": "Сочи", "price": 45000, "duration": 7, "offset": 16, "max_people": 18, "hotel": "Sea View Sochi Hotel", "address": "Сочи, Курортный проспект, 89", "lat": 43.5681, "lng": 39.7425},
    {"title": "Казань: культура и гастрономия", "country": "Россия", "city": "Казань", "price": 38000, "duration": 4, "offset": 30, "max_people": 22, "hotel": "Kazan Center Hotel", "address": "Казань, ул. Баумана, 15", "lat": 55.7961, "lng": 49.1064},
    {"title": "Санкт-Петербург: белые ночи", "country": "Россия", "city": "Санкт-Петербург", "price": 52000, "duration": 5, "offset": 45, "max_people": 20, "hotel": "Nevsky Comfort", "address": "Санкт-Петербург, Невский проспект, 70", "lat": 59.9343, "lng": 30.3351},
    {"title": "Москва: выходные в столице", "country": "Россия", "city": "Москва", "price": 34000, "duration": 3, "offset": 8, "max_people": 24, "hotel": "Moscow City Stay", "address": "Москва, Тверская ул., 12", "lat": 55.7602, "lng": 37.6109},
    {"title": "Дубай: современный мегаполис", "country": "ОАЭ", "city": "Дубай", "price": 145000, "duration": 7, "offset": 60, "max_people": 14, "hotel": "Dubai Marina Resort", "address": "Dubai Marina, Dubai", "lat": 25.0800, "lng": 55.1400},
    {"title": "Стамбул: два континента", "country": "Турция", "city": "Стамбул", "price": 78000, "duration": 6, "offset": 25, "max_people": 16, "hotel": "Sultanahmet Boutique", "address": "Sultanahmet, Istanbul", "lat": 41.0082, "lng": 28.9784},
    {"title": "Анталья: семейный отдых", "country": "Турция", "city": "Анталья", "price": 93000, "duration": 10, "offset": 75, "max_people": 26, "hotel": "Antalya Family Resort", "address": "Lara Beach, Antalya", "lat": 36.8500, "lng": 30.7900},
    {"title": "Рим: история и вкус Италии", "country": "Италия", "city": "Рим", "price": 132000, "duration": 6, "offset": 90, "max_people": 12, "hotel": "Roma Centro Hotel", "address": "Via del Corso, Roma", "lat": 41.9028, "lng": 12.4964},
    {"title": "Лондон: городские маршруты", "country": "Великобритания", "city": "Лондон", "price": 80000, "duration": 4, "offset": 6, "max_people": 12, "hotel": "London Central Inn", "address": "Westminster, London", "lat": 51.5072, "lng": -0.1276},
    {"title": "Шарм-эль-Шейх: Красное море", "country": "Египет", "city": "Шарм-эль-Шейх", "price": 99000, "duration": 9, "offset": 42, "max_people": 28, "hotel": "Red Sea Beach Resort", "address": "Naama Bay, Sharm El Sheikh", "lat": 27.9158, "lng": 34.3299},
    {"title": "Архив: Сочи весенний тур", "country": "Россия", "city": "Сочи", "price": 41000, "duration": 5, "offset": -70, "max_people": 18, "hotel": "Sochi Spring Hotel", "address": "Сочи, ул. Орджоникидзе, 11", "lat": 43.5815, "lng": 39.7231},
    {"title": "Архив: Казань майские праздники", "country": "Россия", "city": "Казань", "price": 36000, "duration": 3, "offset": -35, "max_people": 20, "hotel": "Kazan Old Town", "address": "Казань, ул. Кремлевская, 9", "lat": 55.7986, "lng": 49.1057},
]

ADDITIONAL_TOURS = [
    {"title": "Москва: искусство и гастрономия", "country": "Россия", "city": "Москва", "price": 47000, "duration": 4, "offset": 36, "max_people": 18, "hotel": "Arbat Residence", "address": "Москва, Новый Арбат, 21", "lat": 55.7522, "lng": 37.5898},
    {"title": "Петербург: дворцы и каналы", "country": "Россия", "city": "Санкт-Петербург", "price": 61000, "duration": 6, "offset": 48, "max_people": 16, "hotel": "Fontanka View", "address": "Санкт-Петербург, наб. Фонтанки, 52", "lat": 59.9288, "lng": 30.3356},
    {"title": "Сочи: активная неделя", "country": "Россия", "city": "Сочи", "price": 59000, "duration": 6, "offset": 54, "max_people": 16, "hotel": "Rosa Mountain Stay", "address": "Сочи, Красная Поляна", "lat": 43.6820, "lng": 40.2630},
    {"title": "Казань: семейные выходные", "country": "Россия", "city": "Казань", "price": 42000, "duration": 4, "offset": 42, "max_people": 20, "hotel": "Bauman Family Hotel", "address": "Казань, ул. Баумана, 36", "lat": 55.7908, "lng": 49.1144},
    {"title": "Стамбул: дворцы и Босфор", "country": "Турция", "city": "Стамбул", "price": 92000, "duration": 7, "offset": 58, "max_people": 14, "hotel": "Bosphorus Terrace", "address": "Karakoy, Istanbul", "lat": 41.0256, "lng": 28.9744},
    {"title": "Анталья: всё включено", "country": "Турция", "city": "Анталья", "price": 118000, "duration": 9, "offset": 66, "max_people": 24, "hotel": "Lara All Inclusive", "address": "Lara Beach, Antalya", "lat": 36.8530, "lng": 30.8060},
    {"title": "Каппадокия: долины и воздушные шары", "country": "Турция", "city": "Каппадокия", "price": 105000, "duration": 5, "offset": 72, "max_people": 12, "hotel": "Goreme Cave Hotel", "address": "Goreme, Cappadocia", "lat": 38.6431, "lng": 34.8289},
    {"title": "Каппадокия: фотографический маршрут", "country": "Турция", "city": "Каппадокия", "price": 124000, "duration": 6, "offset": 84, "max_people": 10, "hotel": "Uchisar Panorama", "address": "Uchisar, Cappadocia", "lat": 38.6306, "lng": 34.8050},
    {"title": "Дубай: премиальная неделя", "country": "ОАЭ", "city": "Дубай", "price": 184000, "duration": 8, "offset": 64, "max_people": 12, "hotel": "Downtown Dubai Hotel", "address": "Downtown Dubai", "lat": 25.1972, "lng": 55.2744},
    {"title": "Абу-Даби: культура и море", "country": "ОАЭ", "city": "Абу-Даби", "price": 156000, "duration": 6, "offset": 74, "max_people": 14, "hotel": "Corniche Grand Hotel", "address": "Corniche Road, Abu Dhabi", "lat": 24.4539, "lng": 54.3773},
    {"title": "Абу-Даби: семейные каникулы", "country": "ОАЭ", "city": "Абу-Даби", "price": 172000, "duration": 7, "offset": 88, "max_people": 18, "hotel": "Yas Island Resort", "address": "Yas Island, Abu Dhabi", "lat": 24.4958, "lng": 54.6044},
    {"title": "Шарджа: культурный эмират", "country": "ОАЭ", "city": "Шарджа", "price": 128000, "duration": 6, "offset": 80, "max_people": 16, "hotel": "Al Majaz Waterfront Hotel", "address": "Al Majaz, Sharjah", "lat": 25.3218, "lng": 55.3763},
    {"title": "Шарджа: море и музеи", "country": "ОАЭ", "city": "Шарджа", "price": 139000, "duration": 7, "offset": 94, "max_people": 16, "hotel": "Sharjah Beach Residence", "address": "Al Khan, Sharjah", "lat": 25.3405, "lng": 55.3647},
    {"title": "Шарм-эль-Шейх: дайвинг и рифы", "country": "Египет", "city": "Шарм-эль-Шейх", "price": 116000, "duration": 8, "offset": 52, "max_people": 20, "hotel": "Naama Bay Dive Resort", "address": "Naama Bay, Sharm El Sheikh", "lat": 27.9150, "lng": 34.3290},
    {"title": "Каир: история древнего Египта", "country": "Египет", "city": "Каир", "price": 97000, "duration": 5, "offset": 62, "max_people": 16, "hotel": "Nile View Cairo", "address": "Garden City, Cairo", "lat": 30.0444, "lng": 31.2357},
    {"title": "Каир и Гиза: большая экскурсия", "country": "Египет", "city": "Каир", "price": 112000, "duration": 6, "offset": 76, "max_people": 14, "hotel": "Giza Pyramids Inn", "address": "Giza, Cairo", "lat": 29.9792, "lng": 31.1342},
    {"title": "Хургада: морские каникулы", "country": "Египет", "city": "Хургада", "price": 104000, "duration": 8, "offset": 68, "max_people": 24, "hotel": "Giftun Beach Resort", "address": "Hurghada Marina", "lat": 27.2579, "lng": 33.8116},
    {"title": "Хургада: семейное всё включено", "country": "Египет", "city": "Хургада", "price": 121000, "duration": 10, "offset": 86, "max_people": 26, "hotel": "Hurghada Family Club", "address": "Sahl Hasheesh, Hurghada", "lat": 27.0364, "lng": 33.8526},
    {"title": "Рим: античность и Ватикан", "country": "Италия", "city": "Рим", "price": 148000, "duration": 7, "offset": 70, "max_people": 12, "hotel": "Vaticano Boutique", "address": "Prati, Roma", "lat": 41.9065, "lng": 12.4578},
    {"title": "Венеция: каналы и острова", "country": "Италия", "city": "Венеция", "price": 154000, "duration": 5, "offset": 78, "max_people": 12, "hotel": "Laguna Venezia", "address": "Cannaregio, Venezia", "lat": 45.4408, "lng": 12.3155},
    {"title": "Венеция: романтический маршрут", "country": "Италия", "city": "Венеция", "price": 176000, "duration": 6, "offset": 92, "max_people": 10, "hotel": "San Marco Residence", "address": "San Marco, Venezia", "lat": 45.4340, "lng": 12.3388},
    {"title": "Флоренция: искусство Ренессанса", "country": "Италия", "city": "Флоренция", "price": 143000, "duration": 5, "offset": 82, "max_people": 14, "hotel": "Arno Art Hotel", "address": "Santa Croce, Firenze", "lat": 43.7696, "lng": 11.2558},
    {"title": "Флоренция и Тоскана", "country": "Италия", "city": "Флоренция", "price": 169000, "duration": 7, "offset": 98, "max_people": 12, "hotel": "Toscana City Residence", "address": "Firenze Centro", "lat": 43.7731, "lng": 11.2560},
    {"title": "Лондон: королевская столица", "country": "Великобритания", "city": "Лондон", "price": 158000, "duration": 6, "offset": 44, "max_people": 12, "hotel": "Westminster Park Hotel", "address": "Westminster, London", "lat": 51.4995, "lng": -0.1248},
    {"title": "Эдинбург: замки и легенды", "country": "Великобритания", "city": "Эдинбург", "price": 146000, "duration": 5, "offset": 56, "max_people": 14, "hotel": "Royal Mile Hotel", "address": "Royal Mile, Edinburgh", "lat": 55.9533, "lng": -3.1883},
    {"title": "Эдинбург и шотландские пейзажи", "country": "Великобритания", "city": "Эдинбург", "price": 171000, "duration": 7, "offset": 90, "max_people": 12, "hotel": "Castle View Residence", "address": "Old Town, Edinburgh", "lat": 55.9486, "lng": -3.1999},
    {"title": "Манчестер: музыка и футбол", "country": "Великобритания", "city": "Манчестер", "price": 132000, "duration": 5, "offset": 60, "max_people": 16, "hotel": "Northern Quarter Hotel", "address": "Northern Quarter, Manchester", "lat": 53.4808, "lng": -2.2426},
    {"title": "Манчестер: индустриальная Англия", "country": "Великобритания", "city": "Манчестер", "price": 149000, "duration": 6, "offset": 96, "max_people": 14, "hotel": "Castlefield City Inn", "address": "Castlefield, Manchester", "lat": 53.4741, "lng": -2.2550},
]

DEMO_TOURS.extend(ADDITIONAL_TOURS)

FIRST_NAMES = [
    "Алексей", "Мария", "Иван", "Анна", "Сергей", "Екатерина", "Дмитрий", "Ольга", "Никита", "Алина",
    "Павел", "Виктория", "Максим", "Елена", "Илья", "Полина", "Артём", "Дарья", "Кирилл", "София",
    "Роман", "Ксения", "Георгий", "Валерия", "Денис", "Юлия", "Матвей", "Наталья", "Егор", "Вероника",
]
LAST_NAMES = [
    "Смирнов", "Иванова", "Кузнецов", "Попова", "Соколов", "Лебедева", "Козлов", "Новикова", "Морозов", "Волкова",
    "Петров", "Соловьёва", "Васильев", "Зайцева", "Павлов", "Семёнова", "Голубев", "Виноградова", "Фёдоров", "Беляева",
    "Михайлов", "Тарасова", "Орлов", "Киселёва", "Макаров", "Андреева", "Николаев", "Захарова", "Ефимов", "Комарова",
]


def _date_from_offset(offset: int, duration: int) -> tuple[date, date]:
    start = date.today() + timedelta(days=offset)
    return start, start + timedelta(days=duration - 1)


def _status_ids(db):
    return {row.code: row.id for row in db.query(models.BookingStatus).all()}


def _payment_status_ids(db):
    return {row.code: row.id for row in db.query(models.PaymentStatus).all()}


def _payment_method_ids(db):
    return {row.code: row.id for row in db.query(models.PaymentMethod).all()}


def _get_or_create_country(db, row: dict):
    country = db.query(models.Country).filter(models.Country.name == row["name"]).first()
    if country:
        for key, value in row.items():
            setattr(country, key, value)
        return country
    country = models.Country(**row)
    db.add(country)
    db.flush()
    return country


def _get_or_create_resort(db, name: str, country: models.Country, description: str):
    resort = db.query(models.Resort).filter(models.Resort.name == name, models.Resort.country_id == country.id).first()
    if resort:
        resort.description = description
        return resort
    resort = models.Resort(
        name=name,
        country_id=country.id,
        description=description,
        infrastructure="Отели, транспорт, кафе, экскурсионные маршруты и точки притяжения для туристов.",
        activities="Обзорные экскурсии, свободное время, прогулки и дополнительные активности по сезону.",
        rating=Decimal("4.60"),
        image_url=city_media_image(name),
    )
    db.add(resort)
    db.flush()
    return resort


def _create_users(db, reset: bool):
    existing = db.query(models.User).filter(models.User.email == f"client01@{DEMO_DOMAIN}").first()
    if existing and not reset:
        return db.query(models.User).filter(models.User.email.like(f"%@{DEMO_DOMAIN}")).all()

    password_hash = get_password_hash(DEMO_PASSWORD)
    users = []
    for index, (first, last) in enumerate(zip(FIRST_NAMES, LAST_NAMES), start=1):
        email = f"client{index:02d}@{DEMO_DOMAIN}"
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            user = models.User(email=email)
            db.add(user)
        user.password_hash = password_hash
        user.role = "client"
        user.first_name = first
        user.last_name = last
        user.phone = f"+79{index:09d}"
        user.is_verified = index % 4 != 0
        user.created_at = datetime.utcnow() - timedelta(days=220 - index * 3)
        user.last_seen_at = None
        users.append(user)

    staff_rows = [
        ("manager.demo@demo.travel", "Марина", "Менеджер", "manager"),
        ("analyst.demo@demo.travel", "Андрей", "Аналитик", "analyst"),
    ]
    for email, first, last, role in staff_rows:
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            user = models.User(email=email)
            db.add(user)
        user.password_hash = password_hash
        user.role = role
        user.first_name = first
        user.last_name = last
        user.phone = "+79005550101"
        user.is_verified = True
        user.created_at = datetime.utcnow() - timedelta(days=180)
        user.last_seen_at = None
        users.append(user)

    db.flush()
    return users


def _create_tours(db, reset: bool):
    countries = {row["name"]: _get_or_create_country(db, row) for row in COUNTRIES}
    resorts = {}
    for name, country_name, description in RESORTS:
        resorts[name] = _get_or_create_resort(db, name, countries[country_name], description)

    tours = []
    city_image_variants = {}
    for index, row in enumerate(DEMO_TOURS):
        tour = db.query(models.Tour).filter(models.Tour.title == row["title"]).first()
        is_new_tour = tour is None
        if not tour:
            tour = models.Tour(title=row["title"])
            db.add(tour)
        start, end = _date_from_offset(row["offset"], row["duration"])
        city = row["city"]
        country = row["country"]
        tour.description = f"Продуманный тур в {city}: проживание, программа отдыха, сопровождение менеджера и ключевые активности по направлению."
        tour.price = Decimal(str(row["price"]))
        tour.duration = row["duration"]
        tour.start_date = start
        tour.end_date = end
        tour.country = country
        tour.city = city
        city_variant = city_image_variants.get(city, 0)
        if is_new_tour or tour.image_url not in city_media_images(city):
            tour.image_url = city_media_image(city, city_variant)
        city_image_variants[city] = city_variant + 1
        tour.image_data = None
        tour.image_type = None
        tour.max_people = row["max_people"]
        experiences = CITY_EXPERIENCES.get(city, ["Обзорная экскурсия", "Свободное время", "Дополнительная активность"])
        program_lines = [f"День 1 — прибытие в {city}, трансфер, заселение и прогулка-знакомство."]
        for day_number in range(2, row["duration"]):
            experience = experiences[(day_number - 2) % len(experiences)]
            program_lines.append(f"День {day_number} — {experience}.")
        if row["duration"] > 1:
            program_lines.append(f"День {row['duration']} — свободное время, выезд из отеля и трансфер.")
        tour.program = "\n".join(program_lines)
        tour.program_details = "Каждый день имеет понятную основную активность. Время начала, точки встречи и дополнительные опции подтверждает менеджер."
        tour.accommodation = f"Размещение в отеле {row['hotel']} или аналогичном варианте по программе тура."
        tour.meals = "Завтраки включены. Для отдельных направлений доступно полупитание или полный пансион по согласованию."
        tour.meals_features = "завтраки включены в базовую стоимость\nособые пожелания по питанию фиксируются в заявке\nдополнительное питание согласуется менеджером"
        tour.activities = "\n".join(experiences)
        tour.activities_features = "Входные билеты по основной программе\nСвободное время для самостоятельных прогулок\nДополнительные экскурсии по выбору"
        tour.resort_info = f"{city} подходит для туристов, которым важны понятный маршрут, комфортное размещение и насыщенная программа без лишней перегрузки."
        tour.resort_features = "развитая туристическая инфраструктура\nудобная логистика и понятные маршруты\nактуальные рекомендации доступны перед поездкой"
        tour.hotel_name = row["hotel"]
        tour.hotel_address = row["address"]
        tour.hotel_description = f"{row['hotel']} — комфортный вариант размещения для гостей тура. Удобное расположение помогает быстро добираться до основных точек программы."
        tour.hotel_features = "удобное расположение\nбазовые удобства для отдыха\nрегистрация и заселение по правилам отеля\nподходит для групповых туристических программ"
        tour.hotel_map_lat = row["lat"]
        tour.hotel_map_lng = row["lng"]
        tour.hotel_map_zoom = 15
        tour.map_lat = row["lat"]
        tour.map_lng = row["lng"]
        tour.map_zoom = 11
        tour.country_id = countries[country].id
        tour.resort_id = resorts.get(city).id if resorts.get(city) else None
        tour.rating = Decimal("0")
        tour.review_count = 0
        tours.append(tour)
    db.flush()
    return tours


def _weighted_status(rnd: random.Random, booking_date: datetime, tour_start: date) -> str:
    if tour_start < date.today() - timedelta(days=5):
        return rnd.choices(["completed", "cancelled", "confirmed"], weights=[72, 16, 12], k=1)[0]
    days_old = (datetime.utcnow() - booking_date).days
    if days_old <= 10:
        return rnd.choices(["pending", "confirmed", "cancelled"], weights=[42, 48, 10], k=1)[0]
    return rnd.choices(["confirmed", "completed", "cancelled", "pending"], weights=[45, 22, 18, 15], k=1)[0]


def _create_bookings(db, users, tours, bookings_count: int):
    rnd = random.Random(RANDOM_SEED)
    status_ids = _status_ids(db)
    payment_status_ids = _payment_status_ids(db)
    method_ids = _payment_method_ids(db)
    payment_methods = list(method_ids.keys()) or ["card"]

    clients = [user for user in users if user.role == "client"]
    if not clients or not tours:
        return []

    created_bookings = []
    start_date = datetime.utcnow() - timedelta(days=180)

    for index in range(bookings_count):
        user = rnd.choice(clients)
        tour = rnd.choice(tours)

        day_offset = rnd.randint(0, 179)
        base_date = start_date + timedelta(days=day_offset)
        # Slightly imitate real demand peaks on Mondays and Thursdays.
        if rnd.random() < 0.22:
            base_date += timedelta(days=(3 - base_date.weekday()) % 7)
        if rnd.random() < 0.14:
            base_date += timedelta(days=(0 - base_date.weekday()) % 7)

        booking_date = base_date.replace(hour=rnd.randint(9, 21), minute=rnd.randint(0, 59), second=0, microsecond=0)
        people_count = rnd.choices([1, 2, 3, 4], weights=[25, 45, 20, 10], k=1)[0]
        status = _weighted_status(rnd, booking_date, tour.start_date)
        payment_status = "paid" if status in {"confirmed", "completed"} else rnd.choices(["pending", "failed", "paid"], weights=[62, 24, 14], k=1)[0]
        payment_method = rnd.choice(payment_methods)
        discount = Decimal("0") if rnd.random() > 0.18 else Decimal(str(rnd.choice([1000, 2000, 3000, 5000])))
        total_price = max(Decimal(str(tour.price)) * people_count - discount, Decimal("0"))

        booking = models.Booking(
            user_id=user.id,
            tour_id=tour.id,
            booking_date=booking_date,
            status=status,
            people_count=people_count,
            total_price=total_price,
            discount_amount=discount,
            payment_status=payment_status,
            payment_method=payment_method,
            status_id=status_ids.get(status),
            payment_status_id=payment_status_ids.get(payment_status),
            payment_method_id=method_ids.get(payment_method),
        )
        db.add(booking)
        db.flush()
        created_bookings.append(booking)

        db.add(models.BookingStatusHistory(
            booking_id=booking.id,
            old_status_id=None,
            new_status_id=status_ids.get(status),
            note="Демо-данные для аналитики и ML-модели",
            changed_at=booking_date + timedelta(minutes=rnd.randint(10, 240)),
        ))

        if payment_status == "paid":
            db.add(models.Payment(
                booking_id=booking.id,
                payment_method_id=method_ids.get(payment_method),
                payment_status_id=payment_status_ids.get("paid"),
                amount=total_price,
                paid_at=booking_date + timedelta(hours=rnd.randint(1, 48)),
                created_at=booking_date + timedelta(minutes=30),
            ))

        if status == "completed" and rnd.random() < 0.58:
            rating = rnd.choices([3, 4, 5], weights=[8, 36, 56], k=1)[0]
            db.add(models.Review(
                user_id=user.id,
                tour_id=tour.id,
                rating=rating,
                comment=rnd.choice([
                    "Хорошая организация поездки, понятная программа и быстрые ответы менеджера.",
                    "Отель и экскурсии соответствовали ожиданиям.",
                    "Удобный маршрут, понравилась работа сервиса.",
                    "Есть небольшие замечания по расписанию, но в целом тур понравился.",
                ]),
                created_at=booking_date + timedelta(days=rnd.randint(15, 90)),
            ))

        if rnd.random() < 0.20:
            exists = db.query(models.Favorite).filter(models.Favorite.user_id == user.id, models.Favorite.tour_id == tour.id).first()
            if not exists:
                db.add(models.Favorite(user_id=user.id, tour_id=tour.id, created_at=booking_date - timedelta(days=rnd.randint(1, 20))))

        if rnd.random() < 0.35:
            db.add(models.UserTourPreference(
                user_id=user.id,
                tour_id=tour.id,
                preference_score=rnd.randint(1, 10),
                viewed_at=booking_date - timedelta(days=rnd.randint(1, 20)),
                booked_at=booking_date,
            ))

    db.flush()
    return created_bookings


def _create_analytics_events(db, users, tours):
    rnd = random.Random(RANDOM_SEED + 99)
    clients = [user for user in users if user.role == "client"]
    events = []
    for _ in range(420):
        user = rnd.choice(clients) if clients and rnd.random() < 0.82 else None
        tour = rnd.choice(tours) if tours and rnd.random() < 0.65 else None
        event_date = datetime.utcnow() - timedelta(days=rnd.randint(0, 90), hours=rnd.randint(0, 23), minutes=rnd.randint(0, 59))
        event_type = rnd.choices(["tour_view", "search", "favorite", "booking_start", "profile_open"], weights=[44, 28, 12, 10, 6], k=1)[0]
        event_data = f"tour_id={tour.id};country={tour.country};city={tour.city}" if tour else "section=home"
        events.append(models.AnalyticsEvent(
            user_id=user.id if user else None,
            event_type=event_type,
            event_data=event_data,
            ip_address=f"127.0.0.{rnd.randint(2, 240)}",
            user_agent="Demo browser",
            created_at=event_date,
        ))
    db.add_all(events)


def _create_notifications(db, users):
    for user in users[:12]:
        db.add(models.Notification(
            user_id=user.id,
            title="Демо-уведомление",
            message="Это тестовое уведомление для проверки личного кабинета и пользовательских сценариев.",
            type="info",
            is_read=user.id % 2 == 0,
            created_at=datetime.utcnow() - timedelta(days=user.id % 12),
        ))


def _update_tour_ratings(db, tours):
    for tour in tours:
        rating_row = db.query(func.coalesce(func.avg(models.Review.rating), 0), func.count(models.Review.id)).filter(models.Review.tour_id == tour.id).one()
        tour.rating = Decimal(str(round(float(rating_row[0] or 0), 1)))
        tour.review_count = int(rating_row[1] or 0)


def _update_user_ratings(db, users):
    for user in users:
        bookings = db.query(models.Booking).filter(models.Booking.user_id == user.id).all()
        if not bookings:
            continue
        paid_total = sum(Decimal(str(item.total_price or 0)) for item in bookings if item.payment_status == "paid")
        completed = sum(1 for item in bookings if item.status == "completed")
        rating = db.query(models.UserRating).filter(models.UserRating.user_id == user.id).first()
        if not rating:
            rating = models.UserRating(user_id=user.id)
            db.add(rating)
        rating.total_bookings = len(bookings)
        rating.total_spent = paid_total
        rating.average_rating = Decimal(str(round(min(5, 3 + completed / 8), 2)))
        rating.rating_level = "gold" if paid_total >= 500000 else "silver" if paid_total >= 200000 else "base"
        rating.points = int(float(paid_total) // 1000)
        rating.last_updated = datetime.utcnow()


def _reset_demo(db):
    demo_user_ids = [item.id for item in db.query(models.User.id).filter(models.User.email.like(f"%@{DEMO_DOMAIN}")).all()]
    demo_tour_titles = [row["title"] for row in DEMO_TOURS]
    demo_tour_ids = [item.id for item in db.query(models.Tour.id).filter(models.Tour.title.in_(demo_tour_titles)).all()]

    if demo_user_ids or demo_tour_ids:
        booking_query = db.query(models.Booking)
        if demo_user_ids and demo_tour_ids:
            booking_query = booking_query.filter((models.Booking.user_id.in_(demo_user_ids)) | (models.Booking.tour_id.in_(demo_tour_ids)))
        elif demo_user_ids:
            booking_query = booking_query.filter(models.Booking.user_id.in_(demo_user_ids))
        else:
            booking_query = booking_query.filter(models.Booking.tour_id.in_(demo_tour_ids))
        for booking in booking_query.all():
            db.delete(booking)

    for model, field in [
        (models.Review, models.Review.user_id),
        (models.Favorite, models.Favorite.user_id),
        (models.Notification, models.Notification.user_id),
        (models.AnalyticsEvent, models.AnalyticsEvent.user_id),
        (models.UserTourPreference, models.UserTourPreference.user_id),
        (models.UserRating, models.UserRating.user_id),
        (models.UserNotificationSettings, models.UserNotificationSettings.user_id),
        (models.UserAchievement, models.UserAchievement.user_id),
        (models.UserLoginHistory, models.UserLoginHistory.user_id),
        (models.UserLog, models.UserLog.user_id),
    ]:
        if demo_user_ids:
            db.query(model).filter(field.in_(demo_user_ids)).delete(synchronize_session=False)

    if demo_tour_ids:
        for model, field in [
            (models.Review, models.Review.tour_id),
            (models.Favorite, models.Favorite.tour_id),
            (models.UserTourPreference, models.UserTourPreference.tour_id),
            (models.TourCategoryLink, models.TourCategoryLink.tour_id),
            (models.TourImage, models.TourImage.tour_id),
        ]:
            db.query(model).filter(field.in_(demo_tour_ids)).delete(synchronize_session=False)

    for user in db.query(models.User).filter(models.User.email.like(f"%@{DEMO_DOMAIN}")).all():
        db.delete(user)
    for tour in db.query(models.Tour).filter(models.Tour.title.in_(demo_tour_titles)).all():
        db.delete(tour)

    db.commit()


def seed_demo_analytics(db, bookings_count: int = 260, reset: bool = False):
    models.Base.metadata.create_all(bind=engine)
    ensure_schema_updates()
    seed_reference_data(db)

    if reset:
        _reset_demo(db)

    already_seeded = db.query(models.User).filter(models.User.email == f"client01@{DEMO_DOMAIN}").first()
    if already_seeded and not reset:
        return {
            "created": False,
            "message": "Демо-данные уже есть. Для пересоздания запусти с флагом --reset.",
            "users": db.query(models.User).count(),
            "tours": db.query(models.Tour).count(),
            "bookings": db.query(models.Booking).count(),
        }

    users = _create_users(db, reset=reset)
    tours = _create_tours(db, reset=reset)
    db.commit()

    bookings = _create_bookings(db, users, tours, bookings_count=bookings_count)
    _create_analytics_events(db, users, tours)
    _create_notifications(db, users)
    db.commit()

    _update_tour_ratings(db, tours)
    _update_user_ratings(db, users)
    db.commit()

    return {
        "created": True,
        "message": "Демо-данные успешно добавлены.",
        "demo_password": DEMO_PASSWORD,
        "demo_users": len(users),
        "demo_tours": len(tours),
        "demo_bookings": len(bookings),
        "total_users": db.query(models.User).count(),
        "total_tours": db.query(models.Tour).count(),
        "total_bookings": db.query(models.Booking).count(),
    }


def main():
    parser = argparse.ArgumentParser(description="Seed Travel Agency demo data for analytics and ML.")
    parser.add_argument("--reset", action="store_true", help="Delete previous demo users/tours/bookings and create them again.")
    parser.add_argument("--bookings", type=int, default=260, help="How many demo bookings to create.")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        result = seed_demo_analytics(db, bookings_count=max(40, args.bookings), reset=args.reset)
        print("\n=== Travel Agency demo seed ===")
        for key, value in result.items():
            print(f"{key}: {value}")
        print("\nДемо-клиент для входа: client01@demo.travel / demo12345")
        print("Демо-аналитик для входа: analyst.demo@demo.travel / demo12345")
    finally:
        db.close()


if __name__ == "__main__":
    main()
