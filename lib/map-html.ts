import type { Hotel } from "./types";
import { hotelImageUrl } from "./hotel-images";

export function buildMapHtml(hotels: Hotel[]): string {
  const pins = JSON.stringify(
    hotels.map((hotel) => ({
      id: hotel.id,
      name: hotel.name,
      location: hotel.location,
      nearSpot: hotel.near_spot,
      imageUrl: hotelImageUrl(hotel),
      lat: hotel.latitude,
      lng: hotel.longitude,
    })),
  ).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1, maximum-scale=1"
  />

  <link
    rel="stylesheet"
    href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
  />

  <style>
    html, body, #map {
      height: 100%;
      width: 100%;
      margin: 0;
      padding: 0;
    }

    .leaflet-container {
      font-family: Arial, sans-serif;
      background: #eef2f5;
    }

    .hotel-popup {
      width: 250px;
      font-family: Arial, sans-serif;
      color: #172554;
    }

    .hotel-popup-image {
      display: block;
      width: 100%;
      height: 145px;
      object-fit: cover;
      border-radius: 8px;
      background: #e2e8f0;
    }

    .hotel-popup-placeholder {
      width: 100%;
      height: 115px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      background: #e2e8f0;
      font-size: 40px;
    }

    .hotel-popup-name {
      margin: 10px 0 5px;
      font-size: 16px;
      font-weight: 700;
    }

    .hotel-popup-location {
      margin: 0 0 10px;
      color: #64748b;
      font-size: 12px;
      line-height: 1.5;
    }

    .hotel-popup-button {
      width: 100%;
      padding: 11px 14px;
      border: 0;
      border-radius: 8px;
      background: #d8b87a;
      color: #172554;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
    }

    .map-fallback {
      box-sizing: border-box;
      height: 100%;
      overflow: auto;
      padding: 16px;
      font-family: Arial, sans-serif;
      background: white;
    }

    .hotel-option {
      display: block;
      width: 100%;
      box-sizing: border-box;
      margin: 12px 0;
      padding: 12px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      background: white;
      text-align: left;
      cursor: pointer;
    }

    .hotel-option img {
      display: block;
      width: 100%;
      height: 130px;
      margin-bottom: 8px;
      border-radius: 7px;
      object-fit: cover;
      background: #e2e8f0;
    }

    .map-notice {
      position: absolute;
      z-index: 1000;
      bottom: 10px;
      left: 10px;
      right: 10px;
      padding: 10px;
      border-radius: 8px;
      background: white;
      color: #334155;
      font-size: 12px;
    }
  </style>
</head>

<body>
  <div id="map"></div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

  <script>
    var hotels = ${pins};

    function sendHotelSelection(id) {
      var message = JSON.stringify({
        type: "hotel",
        id: id
      });

      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(message);
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage(message, "*");
      }
    }

    function escapeHtml(value) {
      return String(value == null ? "" : value).replace(
        /[&<>"']/g,
        function (character) {
          return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
          }[character];
        }
      );
    }

    function showHotelFallback(message) {
      var container = document.getElementById("map");
      container.innerHTML = "";
      container.className = "map-fallback";

      var heading = document.createElement("h3");
      heading.textContent = "Explore stays";
      container.appendChild(heading);

      var note = document.createElement("p");
      note.textContent = message;
      container.appendChild(note);

      hotels.forEach(function (hotel) {
        var button = document.createElement("button");
        button.className = "hotel-option";

        if (hotel.imageUrl) {
          var image = document.createElement("img");
          image.src = hotel.imageUrl;
          image.alt = hotel.name;
          image.onerror = function () {
            image.style.display = "none";
          };
          button.appendChild(image);
        }

        var name = document.createElement("strong");
        name.textContent = hotel.name;
        button.appendChild(name);

        button.onclick = function () {
          sendHotelSelection(hotel.id);
        };

        container.appendChild(button);
      });
    }

    if (typeof L === "undefined") {
      showHotelFallback(
        "The map could not load. You can still select a hotel below."
      );
    } else {
      var map = L.map("map", {
        zoomControl: true
      }).setView([12.5, 122.5], 6);

      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 19,
          attribution: "Tiles &copy; Esri"
        }
      ).addTo(map);

      var bounds = [];

      hotels.forEach(function (hotel) {
        var lat = Number(hotel.lat);
        var lng = Number(hotel.lng);

        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lng) ||
          lat < -90 ||
          lat > 90 ||
          lng < -180 ||
          lng > 180
        ) {
          return;
        }

        var marker = L.marker([lat, lng]).addTo(map);

        var imageMarkup = hotel.imageUrl
          ? '<img class="hotel-popup-image" src="' +
            escapeHtml(hotel.imageUrl) +
            '" alt="' + escapeHtml(hotel.name) +
            '" onerror="this.style.display=\\'none\\';this.nextElementSibling.style.display=\\'flex\\';" />' +
            '<div class="hotel-popup-placeholder" style="display:none">🏝️</div>'
          : '<div class="hotel-popup-placeholder">🏝️</div>';

        var popupContent =
          '<div class="hotel-popup">' +
            imageMarkup +
            '<div class="hotel-popup-name">' +
              escapeHtml(hotel.name) +
            '</div>' +
            '<div class="hotel-popup-location">' +
              '📍 ' + escapeHtml(hotel.location || "Philippines") +
              (hotel.nearSpot
                ? '<br />Near ' + escapeHtml(hotel.nearSpot)
                : '') +
            '</div>' +
            '<button type="button" class="hotel-popup-button" data-hotel-id="' +
              escapeHtml(hotel.id) +
            '">View hotel</button>' +
          '</div>';

        marker.bindPopup(popupContent, {
          maxWidth: 280,
          minWidth: 250
        });

        marker.on("popupopen", function (event) {
          var popupElement = event.popup.getElement();

          if (!popupElement) return;

          var button = popupElement.querySelector(".hotel-popup-button");

          if (button) {
            button.onclick = function () {
              sendHotelSelection(hotel.id);
            };
          }
        });

        bounds.push([lat, lng]);
      });

      if (bounds.length === 1) {
        map.setView(bounds[0], 13);
      } else if (bounds.length > 1) {
        map.fitBounds(bounds, {
          padding: [30, 30],
          maxZoom: 13
        });
      }

      var tileErrorShown = false;

      map.on("tileerror", function () {
        if (tileErrorShown) return;
        tileErrorShown = true;

        var notice = document.createElement("div");
        notice.className = "map-notice";
        notice.textContent =
          "Map tiles could not load. Check your connection or map service access.";

        document.getElementById("map").appendChild(notice);
      });
    }
  </script>
</body>
</html>`;
}
