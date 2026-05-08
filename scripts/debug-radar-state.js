/**
 * Comprehensive Radar Debug Script
 * Run this in browser console while app is open
 */

console.clear();
console.log('🔍 RADAR DEBUG REPORT\n' + '='.repeat(60));

// 1. Check if map exists
if (!window.map) {
  console.error('❌ window.map is not defined - map not initialized');
} else {
  console.log('✅ Map instance found');

  const map = window.map;

  // 2. Check if style is loaded
  if (!map.isStyleLoaded()) {
    console.warn('⚠️  Map style not fully loaded yet - wait and run again');
  } else {
    console.log('✅ Map style loaded');
  }

  const style = map.getStyle();

  // 3. Check sources
  const sources = Object.keys(style.sources || {});
  const radarSources = sources.filter(s => s.startsWith('radar-source-'));

  console.log(`\n📡 SOURCES (${sources.length} total, ${radarSources.length} radar):`);

  if (radarSources.length === 0) {
    console.error('❌ NO RADAR SOURCES FOUND!');
    console.log('   This means useRadarAnimation is not adding sources to the map');
  } else {
    radarSources.forEach(sourceId => {
      const source = map.getSource(sourceId);
      console.log(`\n  ${sourceId}:`);
      console.log(`    Type: ${source.type}`);
      console.log(`    Tiles: ${source.tiles ? source.tiles[0] : 'none'}`);
      console.log(`    Loaded: ${source._loaded || 'unknown'}`);
    });
  }

  // 4. Check layers
  const layers = style.layers || [];
  const radarLayers = layers.filter(l => l.id.startsWith('radar-layer-'));

  console.log(`\n🗺️  LAYERS (${layers.length} total, ${radarLayers.length} radar):`);

  if (radarLayers.length === 0) {
    console.error('❌ NO RADAR LAYERS FOUND!');
  } else {
    radarLayers.forEach(layer => {
      const visibility = map.getLayoutProperty(layer.id, 'visibility');
      const opacity = map.getPaintProperty(layer.id, 'raster-opacity');

      const status = visibility === 'visible' && opacity > 0 ? '✅' : '⚠️ ';
      console.log(`\n  ${status} ${layer.id}:`);
      console.log(`    Visibility: ${visibility}`);
      console.log(`    Opacity: ${opacity}`);
      console.log(`    Source: ${layer.source}`);
    });
  }

  // 5. Check viewport
  const center = map.getCenter();
  const zoom = map.getZoom();
  console.log(`\n📍 VIEWPORT:`);
  console.log(`  Center: ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`);
  console.log(`  Zoom: ${zoom.toFixed(2)}`);

  // 6. Summary
  console.log('\n📊 SUMMARY:');

  const visibleLayers = radarLayers.filter(l =>
    map.getLayoutProperty(l.id, 'visibility') === 'visible' &&
    map.getPaintProperty(l.id, 'raster-opacity') > 0
  );

  if (radarSources.length === 0 || radarLayers.length === 0) {
    console.error('❌ PROBLEM: Radar sources/layers not added to map');
    console.log('   Check if useRadarAnimation hook is running');
    console.log('   Check React DevTools for RadarOverlay component state');
  } else if (visibleLayers.length === 0) {
    console.error('❌ PROBLEM: Radar layers exist but all are hidden or transparent');
    console.log('   - Check if visibility is set to "visible" for current frame');
    console.log('   - Check if opacity is > 0');
    console.log('   - Check RadarOverlay state: currentFrame, visible, opacity');
  } else {
    console.log(`✅ ${visibleLayers.length} visible radar layer(s) with opacity > 0`);
    console.log('   If tiles still not showing, check Network tab for tile requests');
  }
}

// 7. Check Network requests (requires manual check)
console.log('\n🌐 NEXT: Check Network Tab');
console.log('  1. Open Network tab');
console.log('  2. Filter by "rainviewer"');
console.log('  3. Look for:');
console.log('     - api.rainviewer.com/public/weather-maps.json (should be 200)');
console.log('     - tilecache.rainviewer.com tiles (should be multiple 200s)');
console.log('  4. If NO tile requests appear, layers may have visibility: "none"');

console.log('\n' + '='.repeat(60));
