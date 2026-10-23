shader_type spatial;
// Ground material: grass / dirt / rock / sand blended by slope, height and an optional splat map,
// with large-scale variation so the ground does not read as one flat colour or one repeating tile.
// Works on any ground mesh (MeshInstance3D, chunked terrain, a GridMap floor). Compatibility and Forward+.
render_mode specular_schlick_ggx;

// Layer colours (design/palette.json). The grass colour should match the grass shader's root_color
// so the ground between blades continues the field instead of showing through as another material.
uniform vec4 grass_color : source_color = vec4(0.20, 0.33, 0.12, 1.0);
uniform vec4 dirt_color : source_color = vec4(0.36, 0.28, 0.19, 1.0);
uniform vec4 rock_color : source_color = vec4(0.42, 0.40, 0.37, 1.0);
uniform vec4 sand_color : source_color = vec4(0.70, 0.63, 0.47, 1.0);

// Optional tiling textures per layer (white = colour only). Albedo textures need source_color.
uniform sampler2D grass_texture : source_color, filter_linear_mipmap, repeat_enable, hint_default_white;
uniform sampler2D dirt_texture : source_color, filter_linear_mipmap, repeat_enable, hint_default_white;
uniform sampler2D rock_texture : source_color, filter_linear_mipmap, repeat_enable, hint_default_white;
uniform float texture_scale = 0.25; // repeats per metre

// Optional splat map over `splat_rect` (x, z, width, depth in metres): R = dirt (paths), G = sand,
// B = extra rock. Paint paths and clearings here; leave it unset to use slope and height only.
uniform sampler2D splat_map : filter_linear, repeat_disable, hint_default_black;
uniform vec4 splat_rect = vec4(-50.0, -50.0, 100.0, 100.0);

uniform float rock_slope_start : hint_range(0.0, 1.0) = 0.25; // 1 - normal.y where rock begins
uniform float rock_slope_end : hint_range(0.0, 1.0) = 0.45;
uniform float sand_below = -1000.0; // world height under which ground turns to sand (shores)
uniform float macro_size = 18.0;    // metres per large colour blotch
uniform float macro_strength : hint_range(0.0, 0.5) = 0.18;

varying vec3 v_world;
varying vec3 v_world_normal;

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

// Projects the texture from the three axes so steep rock is not stretched.
vec3 triplanar(sampler2D tex, vec3 p, vec3 n) {
	vec3 w = pow(abs(n), vec3(4.0));
	w /= (w.x + w.y + w.z);
	return texture(tex, p.zy * texture_scale).rgb * w.x + texture(tex, p.xz * texture_scale).rgb * w.y
		+ texture(tex, p.xy * texture_scale).rgb * w.z;
}

void vertex() {
	v_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	v_world_normal = normalize(mat3(MODEL_MATRIX) * NORMAL);
}

void fragment() {
	vec2 uv = v_world.xz * texture_scale;
	float slope = 1.0 - v_world_normal.y;
	float macro = noise(v_world.xz / macro_size) * 0.65 + noise(v_world.xz / (macro_size * 0.23)) * 0.35;
	vec4 splat = texture(splat_map, (v_world.xz - splat_rect.xy) / splat_rect.zw);

	vec3 grass = grass_color.rgb * texture(grass_texture, uv).rgb;
	vec3 dirt = dirt_color.rgb * texture(dirt_texture, uv).rgb;
	vec3 rock = rock_color.rgb * triplanar(rock_texture, v_world, v_world_normal);
	vec3 sand = sand_color.rgb * texture(dirt_texture, uv * 1.7).rgb;

	// Noisy edges: break the blend line with the macro noise instead of a straight contour.
	float edge = (macro - 0.5) * 0.12;
	vec3 color = mix(grass, dirt, smoothstep(0.35, 0.65, splat.r + edge));
	color = mix(color, sand, max(smoothstep(0.35, 0.65, splat.g + edge),
		1.0 - smoothstep(sand_below - 0.4, sand_below + 0.4, v_world.y + edge * 4.0)));
	float rock_w = max(smoothstep(rock_slope_start, rock_slope_end, slope + edge), smoothstep(0.35, 0.65, splat.b + edge));
	color = mix(color, rock, rock_w);
	color *= 1.0 + (macro - 0.5) * 2.0 * macro_strength;

	ALBEDO = color;
	ROUGHNESS = mix(0.95, 0.8, rock_w);
	SPECULAR = 0.3;
}
