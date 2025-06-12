// ----------------------------------------------
// USER INPUT: Latitude and Longitude of center point
// ----------------------------------------------
var lat = 10.826210;     // Replace with your latitude
var lon = 78.744380;     // Replace with your longitude
var bufferRadius = 200; // Radius in meters

// Step 1: Create a point and buffer it
var point = ee.Geometry.Point([lon, lat]);
var roi = point.buffer(bufferRadius);
Map.centerObject(roi, 17);
Map.addLayer(roi, {color: 'red'}, 'Buffered ROI');

// Step 2: Load Sentinel-2 Surface Reflectance ImageCollection
var s2 = ee.ImageCollection("COPERNICUS/S2_SR")
  .filterBounds(roi)
  .filterDate('2025-01-01', '2025-06-01')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))
  .median();

// Step 3: Compute NDVI = (B8 - B4) / (B8 + B4)
var ndvi = s2.normalizedDifference(['B8', 'B4']).rename('NDVI');

// Step 4: Threshold NDVI to detect vegetated (crop) areas
var ndviThreshold = 0.4;
var cropMask = ndvi.gt(ndviThreshold);  // Boolean mask (0/1)
var maskedNDVI = cropMask.selfMask();   // Mask out 0 values

// Visualize NDVI and mask
Map.addLayer(ndvi, {min: 0, max: 1, palette: ['red', 'yellow', 'green']}, 'NDVI');
Map.addLayer(maskedNDVI, {palette: ['white', 'green']}, 'NDVI > ' + ndviThreshold);

// Step 5: Convert binary mask to integer (required!)
var binary = cropMask.multiply(1).toByte();  // Convert to 0/1 integer image

// Step 6: Extract vector polygons using reduceToVectors
var fields = binary.reduceToVectors({
  geometry: roi,
  scale: 10,
  geometryType: 'polygon',
  reducer: ee.Reducer.countEvery(),
  maxPixels: 1e9
});

// Step 7: Filter small polygons (< 500 sq.m.) with error margin in area
var cleanFields = fields.map(function(feature) {
  var area = feature.geometry().area(1);  // 1 meter error margin
  return feature.set('area', area);
}).filter(ee.Filter.gte('area', 500));

// Display vector output
Map.addLayer(cleanFields, {color: 'cyan'}, 'Filtered Fields');
print('Detected Field Polygons:', cleanFields);
