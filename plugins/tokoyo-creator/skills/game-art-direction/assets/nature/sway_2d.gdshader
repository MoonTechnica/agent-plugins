shader_type canvas_item;
// Sways the top of 2D plants (grass tufts, bushes, flowers, hanging vines) while the bottom stays put.
// For a Sprite2D / TextureRect whose texture is the whole plant: UV.y is 0 at the top, 1 at the bottom.
// For a sprite cut from an atlas (region_enabled) set region_top / region_bottom to the region's UV
// rows; atlas tiles in a TileMapLayer need their own per-tile weight and are not covered here.
render_mode blend_mix;

uniform float strength = 4.0;        // pixels at the very top
uniform float speed = 1.5;
uniform float region_top = 0.0;
uniform float region_bottom = 1.0;
// Set from GDScript when something walks through: x = world x of the walker, y = push in pixels.
uniform vec2 push = vec2(0.0, 0.0);
uniform float push_radius = 24.0;

void vertex() {
	float weight = clamp((region_bottom - UV.y) / max(region_bottom - region_top, 0.0001), 0.0, 1.0);
	vec2 world = (MODEL_MATRIX * vec4(VERTEX, 0.0, 1.0)).xy;
	float phase = world.x * 0.05;
	float sway = sin(TIME * speed + phase) * 0.7 + sin(TIME * speed * 2.3 + phase * 1.7) * 0.3;
	float near = 1.0 - smoothstep(0.0, push_radius, abs(world.x - push.x));
	VERTEX.x += (sway * strength + sign(world.x - push.x) * push.y * near) * weight * weight;
}
