# 🎲 Dinner Shuffle

Can't decide where to eat? Dinner Shuffle finds restaurants near you, sorts them by cuisine,
and gives you **3 picks, each from a different category**.

## Features

- 📍 **Nearby restaurants**: uses your phone's location, or you can search any city or address
- 🥢 **Grouped by cuisine**: Chinese, Japanese, Korean, Thai, Vietnamese, Indian, Other Asian, Italian,
  Pizza, Mexican, Latin American, Mediterranean, American, Fast Food, Seafood, European, African
- 🔀 **Shuffle**: 3 random restaurants from 3 different cuisines. Tap 🔓 to keep a pick while you reshuffle the others
- ✅ **In the mood for…**: turn categories on or off to control what goes into the shuffle
- 🗺️ **Let's go**: opens directions (Apple Maps on iPhone, Google Maps elsewhere). Call and Website buttons when available
- 🕒 **History**: remembers where you went and skips places from the last 7 days (can be turned off)
- 📋 **Browse**: every nearby restaurant, listed by category and distance
- 🚫 **Hide closed places**: ⋯ → *Hide this place*, with Undo. Bring them back from History
- 🏷️ **Fix categories**: ⋯ → *Category* moves a place into the right group
- ➕ **Add missing restaurants**: Browse → *Add a restaurant*, found on the map by name or address
- 🔎 **Smarter sorting**: places with no cuisine tag are sorted by name ("Seoul Garden" → Korean)
- 📱 **Installable app (PWA)**: add it to your home screen and it opens full-screen like a native app, with dark mode

## Installing on your phone

1. Open the deployed URL on your phone (it must be **https**, or location won't work).
2. **iPhone (Safari):** Share → *Add to Home Screen*.
   **Android (Chrome):** ⋮ menu → *Install app* / *Add to Home screen*.
3. Allow location access the first time you tap **Use my location**.

## Where the data comes from

Restaurants come from [OpenStreetMap](https://www.openstreetmap.org/) via the free
[Overpass API](https://overpass-api.de/), and place search uses [Nominatim](https://nominatim.org/).
Neither needs an API key. Results are cached on the device for 12 hours.

OpenStreetMap coverage varies by area. Places with no cuisine tag are sorted by their name when
possible; the rest go into **Other**, which is off by default. Places marked closed in the map data
are skipped. Hidden places, category fixes and your own added restaurants are saved on your device.
To fix the map for everyone, edit the place on [openstreetmap.org](https://www.openstreetmap.org/). Ratings, photos and "open now" would need a commercial source such as Google Places or
Yelp, which require an API key (see *Ideas*).

## Project layout

```
public/
├── index.html            # App shell
├── styles.css            # Mobile-first styles (light + dark)
├── categories.js         # Cuisine → category mapping
├── app.js                # Location, fetching, shuffle, UI
├── manifest.webmanifest  # PWA manifest
├── sw.js                 # Service worker (offline app shell)
└── icons/
test/                     # Unit tests (node --test)
wrangler.toml             # Cloudflare static-assets config
```

## Development

```bash
npm start          # http://localhost:8000 (location works on localhost)
npm test           # unit tests for cuisine categorisation
```

To add or adjust a category, edit `public/categories.js`. Each category lists the OpenStreetMap
`cuisine=*` values it matches.

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) (`npm run deploy` to Cloudflare).

## Ideas

- "Open now" filter (parse `opening_hours`)
- Ratings and photos via Google Places / Yelp, proxied through a Cloudflare Worker to keep the API key secret
- Price-level filter, favourites, sharing the 3 picks with a friend to vote
- Wrap as a native App Store / Play Store app with Capacitor

## License

MIT
