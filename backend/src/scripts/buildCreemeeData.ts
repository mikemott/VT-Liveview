/**
 * Creemee Stands Data Builder
 *
 * One-time script to build creemee stands dataset with geocoded coordinates.
 * Data sourced from Find & Go Seek and Vermont travel sites.
 *
 * Usage:
 *   npx tsx src/scripts/buildCreemeeData.ts
 *
 * Output:
 *   src/data/creemeeStands.json
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface SourceStand {
  name: string;
  town: string;
  description?: string;
  specialties?: string[];
  featured?: boolean;
}

interface CreemeeStand {
  id: string;
  name: string;
  town: string;
  latitude: number;
  longitude: number;
  description?: string;
  specialties?: string[];
  featured: boolean;
}

// Source data from Find & Go Seek + Vermont travel sites
// Featured stands are top-rated from Travel Like a Local VT, Seven Days, Vermont Public
const sourceStands: SourceStand[] = [
  // Featured stands (top-rated from multiple sources)
  {
    name: "Burlington Bay Market & Cafe",
    town: "Burlington",
    description: "Maple creemee is their best seller. Battery Street near waterfront.",
    specialties: ["Maple Creemee"],
    featured: true
  },
  {
    name: "Morse Farm Maple Sugarworks",
    town: "Montpelier",
    description: "Eighth-generation sugaring family. Specializes in maple creemees.",
    specialties: ["Maple Creemee", "Working Sugarhouse"],
    featured: true
  },
  {
    name: "Canteen Creemee Company",
    town: "Waitsfield",
    description: "Unique flavors: toasted marshmallow, ginger, coffee. Creative sundaes.",
    specialties: ["Toasted Marshmallow", "Ginger", "Coffee"],
    featured: true
  },
  {
    name: "Red Hen Baking Co. Cafe",
    town: "Middlesex",
    description: "Vermont Public 2025 featured stand.",
    featured: true
  },
  {
    name: "Palmer Lane Maple",
    town: "Jericho",
    description: "Seven Days VT 2024 Best Creemee winner.",
    specialties: ["Maple Creemee"],
    featured: true
  },
  {
    name: "Vermont Cookie Love",
    town: "North Ferrisburgh",
    description: "Creates 'love-wiches' - creemee between cookies. Maple-coffee twist.",
    specialties: ["Love-wiches", "Maple-Coffee Twist"],
    featured: true
  },
  {
    name: "Bragg Farm Sugarhouse & Gift Shop",
    town: "East Montpelier",
    description: "Working sugarhouse with maple creemees. Farm-fresh experience.",
    specialties: ["Maple Creemee"],
    featured: true
  },

  // Popular stands from Find & Go Seek
  { name: "Al's French Frys", town: "South Burlington" },
  { name: "Allenholm Farm", town: "South Hero" },
  { name: "April's Maple", town: "Canaan" },
  { name: "Archie's Grill", town: "Shelburne" },
  { name: "Beansie's Bus", town: "Burlington", description: "Battery Park edge" },
  { name: "Broad Acres Creemee Stand", town: "Colchester" },
  { name: "C Village Store", town: "Craftsbury" },
  { name: "Champ's Legendary Creemees", town: "Burlington", description: "At ECHO" },
  { name: "Chef's Corner Café & Bakery", town: "Williston" },
  { name: "Dairy Creme", town: "Montpelier" },
  { name: "Devyn's Restaurant Creemee Stand", town: "Swanton" },
  { name: "Duke's Creemees", town: "Milton" },
  { name: "Full Belly Farm", town: "Monkton" },
  { name: "Gagne Maple", town: "Highgate" },
  { name: "Georgia Farmhouse", town: "Milton" },
  { name: "Goodie's Snack Bar", town: "Addison", description: "Oversized creemee for low prices. Cash or check only." },
  { name: "Hardwick House of Pizza", town: "Hardwick" },
  { name: "Hero's Welcome General Store", town: "North Hero", description: "Lake Champlain shore" },
  { name: "Hoss's Dogg House", town: "St. Albans" },
  { name: "Ice Cream Window @ Lake Champlain Chocolates", town: "Burlington" },
  { name: "Jericho Center Country Store", town: "Jericho" },
  { name: "Joe's Snack Bar", town: "Jericho", description: "Adjacent to Old Mill Park" },
  { name: "Kate's Food Truck", town: "Jericho" },
  { name: "Kellee's Creemee & Grill", town: "Waterbury" },
  { name: "LegenDairy Maple & Ice Cream", town: "Williamstown" },
  { name: "Little Gordo Creemee Stand", town: "Burlington" },
  { name: "Lu Lu", town: "Vergennes" },
  { name: "Maple City Candy & Ice Cream Stand", town: "Swanton" },
  { name: "Maple Wind Farm", town: "Richmond" },
  { name: "Milkhouse Ice Cream", town: "St. Johnsbury" },
  { name: "Offbeat Creemee", town: "Winooski", description: "Myers Memorial Pool" },
  { name: "Papa Nick's Family Restaurant", town: "Hinesburg" },
  { name: "Scout & Co.", town: "Burlington" },
  { name: "Seb's Snack Bar", town: "South Hero", description: "Village green" },
  { name: "Shelburne Country Store", town: "Shelburne" },
  { name: "Silloway Maple", town: "Randolph Center" },
  { name: "Sisters of Anarchy @ Fisher Brothers Farm", town: "Shelburne" },
  { name: "Sweet Roots Farm", town: "Charlotte" },
  { name: "Sweet Scoops", town: "Essex Junction" },
  { name: "The Bay Store", town: "St. Albans", description: "Lake Champlain views" },
  { name: "The Mill Market & Deli", town: "South Burlington" },
  { name: "The Scoop", town: "Shelburne" },
  { name: "The Shiretown Marketplace", town: "Middlebury" },
  { name: "The Village Scoop", town: "Colchester", description: "Drive-through and indoor seating" },
  { name: "Toby's Treats", town: "St. Albans" },
];

/**
 * Geocode a location using OpenStreetMap Nominatim API
 * Rate limit: 1 request per second
 */
async function geocode(name: string, town: string): Promise<{ lat: number; lng: number }> {
  const query = `${name}, ${town}, Vermont`;
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'VT-LiveView/1.0 (Educational; mike@mottvt.com)'
    }
  });

  if (!response.ok) {
    throw new Error(`Nominatim API error: ${response.status}`);
  }

  const data = await response.json();

  if (data.length === 0) {
    throw new Error(`Could not geocode: ${name}, ${town}`);
  }

  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon)
  };
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate slug from name
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Main build function
 */
async function buildCreemeeData(): Promise<void> {
  console.log('🍦 Building Creemee Stands Dataset\n');
  console.log(`Total stands to geocode: ${sourceStands.length}`);
  console.log('Rate limit: 1 request/second (Nominatim policy)\n');

  const stands: CreemeeStand[] = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < sourceStands.length; i++) {
    const source = sourceStands[i];
    const progress = `[${i + 1}/${sourceStands.length}]`;

    try {
      console.log(`${progress} Geocoding: ${source.name}, ${source.town}...`);

      const coords = await geocode(source.name, source.town);

      stands.push({
        id: slugify(source.name),
        name: source.name,
        town: source.town,
        latitude: coords.lat,
        longitude: coords.lng,
        description: source.description,
        specialties: source.specialties,
        featured: source.featured || false,
      });

      console.log(`  ✓ Success: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
      successCount++;

      // Rate limit: 1 request per second
      if (i < sourceStands.length - 1) {
        await sleep(1100); // 1.1 seconds to be safe
      }

    } catch (error) {
      console.error(`  ✗ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      failCount++;

      // Continue with next stand even if one fails
      await sleep(1100);
    }
  }

  // Write output
  const outputPath = join(__dirname, '../data/creemeeStands.json');
  writeFileSync(outputPath, JSON.stringify(stands, null, 2));

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Build Complete\n');
  console.log(`✓ Successful: ${successCount}`);
  console.log(`✗ Failed:     ${failCount}`);
  console.log(`📁 Output:    ${outputPath}`);
  console.log(`🍦 Total stands: ${stands.length}`);
  console.log(`⭐ Featured stands: ${stands.filter(s => s.featured).length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (failCount > 0) {
    console.log('⚠️  Some geocoding failed. Review errors above and consider:');
    console.log('   - Checking spelling of stand name/town');
    console.log('   - Manually adding coordinates for failed stands');
    console.log('   - Re-running script after a few minutes\n');
  }
}

// Run the script
buildCreemeeData().catch(error => {
  console.error('\n❌ Build failed:', error);
  process.exit(1);
});
