shader_type spatial;
// Stylised water surface (lakes, rivers, sea) without screen or depth textures, so it runs on
// Compatibility. Shore foam and shallow colour come from the terrain height under the water,
// read from the same heightmap the terrain uses (`shore_heightmap` over `shore_rect`).
render_mode blend_mix, cull_back, depth_draw_opaque, specular_schlick_ggx;

uniform vec4 deep_color : source_color = vec4(0.05, 0.22, 0.32, 0.92);
uniform vec4 shallow_color : source_color = vec4(0.22, 0.55, 0.55, 0.65);
uniform vec4 foam_color : source_color = vec4(0.92, 0.96, 0.95, 1.0);
uniform float wave_height = 0.06;
uniform float wave_speed = 0.6;
uniform float ripple_scale = 0.35;

// Optional: terrain height (0..1 * height_scale) to find depth below the surface.
uniform sampler2D shore_heightmap : filter_linear, repeat_disable, hint_default_black;
uniform vec4 shore_rect = vec4(-50.0, -50.0, 100.0, 100.0);
uniform float height_scale = 0.0; // 0 = no heightmap: the whole surface uses deep/shallow by fresnel only
uniform float height_offset = 0.0; // ground = texel * height_scale + height_offset (metres)
uniform float shallow_depth = 1.5;
uniform float foam_depth = 0.25;

varying vec3 v_world;

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float waves(vec2 p, float t) {
	return noise(p * ripple_scale + vec2(t, t * 0.7)) * 0.6 + noise(p * ripple_scale * 2.3 - vec2(t * 0.8, t * 1.3)) * 0.4;
}

void vertex() {
	v_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	VERTEX.y += (waves(v_world.xz, TIME * wave_speed) - 0.5) * wave_height;
}

void fragment() {
	float t = TIME * wave_speed;
	float e = 0.15;
	float h = waves(v_world.xz, t);
	vec3 n = normalize(vec3(h - waves(v_world.xz + vec2(e, 0.0), t), e * 1.5, h - waves(v_world.xz + vec2(0.0, e), t)));
	NORMAL = normalize((VIEW_MATRIX * vec4(n, 0.0)).xyz);

	float depth = 1000.0;
	if (height_scale > 0.0) {
		float ground = texture(shore_heightmap, (v_world.xz - shore_rect.xy) / shore_rect.zw).r * height_scale + height_offset;
		depth = v_world.y - ground;
	}
	float fresnel = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 3.0);
	vec4 water = mix(shallow_color, deep_color, clamp(depth / shallow_depth, 0.0, 1.0));
	water.rgb = mix(water.rgb, water.rgb * 1.4 + 0.05, fresnel * 0.5);
	float foam = (1.0 - smoothstep(foam_depth * 0.5, foam_depth, depth + (h - 0.5) * 0.15));
	ALBEDO = mix(water.rgb, foam_color.rgb, foam);
	ALPHA = mix(clamp(water.a + fresnel * 0.3, 0.0, 1.0), 1.0, foam);
	ROUGHNESS = mix(0.08, 0.6, foam);
	METALLIC = 0.0;
	SPECULAR = 0.6;
}
