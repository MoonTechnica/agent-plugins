shader_type spatial;
// Grass blades for MultiMesh clumps. Works on Compatibility (Web / embedded native) and Forward+.
// Mesh contract: UV.y is 0 at the root and 1 at the tip (nature_meshes.gd builds it that way;
// a Blender blade needs the same UV). The root never moves, so blades stay planted.
render_mode cull_disabled, specular_schlick_ggx;

// Colours come from design/palette.json; source_color converts them from sRGB.
uniform vec4 root_color : source_color = vec4(0.16, 0.30, 0.10, 1.0);
uniform vec4 tip_color : source_color = vec4(0.55, 0.72, 0.30, 1.0);
// Brightness/hue spread between clumps so the field does not read as one flat sheet.
uniform float color_variation : hint_range(0.0, 0.5) = 0.18;
// Darkens the lower part like ambient occlusion between blades.
uniform float root_occlusion : hint_range(0.0, 1.0) = 0.55;
// Light through the blade when the sun is behind it (cheap translucency).
uniform float translucency : hint_range(0.0, 1.0) = 0.35;

uniform vec2 wind_direction = vec2(1.0, 0.3);
uniform float wind_strength : hint_range(0.0, 1.0) = 0.25;
uniform float wind_speed = 1.2;
// Size of a gust in metres; gusts roll across the field instead of every blade waving in sync.
uniform float gust_size = 12.0;

// Blades shrink into the ground between these distances (no alpha, works without fade support).
uniform float fade_start = 30.0;
uniform float fade_end = 40.0;

// xyz = position of the thing pushing the grass (player), w = radius. w = 0 turns it off.
uniform vec4 trample = vec4(0.0, 0.0, 0.0, 0.0);

varying float v_tip;
varying vec3 v_tint;
varying vec3 v_up_view;

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void vertex() {
	float tip = clamp(UV.y, 0.0, 1.0);
	vec3 world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	// Instance origin (MultiMesh instance transform is part of MODEL_MATRIX).
	vec3 origin = MODEL_MATRIX[3].xyz;
	float seed = hash(origin.xz);

	vec2 dir = normalize(wind_direction);
	float t = TIME * wind_speed;
	float gust = noise(origin.xz / gust_size - dir * t * 0.35);
	float sway = sin(t * 2.0 + seed * 6.283 + dot(origin.xz, dir) * 0.35) * 0.35;
	float bend = wind_strength * (gust * 1.4 + sway) * tip * tip;
	vec3 offset = vec3(dir.x, 0.0, dir.y) * bend;

	if (trample.w > 0.0) {
		vec3 away = origin - trample.xyz;
		float d = length(away.xz);
		float push = (1.0 - smoothstep(trample.w * 0.4, trample.w, d)) * tip;
		offset += vec3(away.x, 0.0, away.z) / max(d, 0.001) * push * 0.6;
		offset.y -= push * 0.35;
	}

	float cam = distance(origin.xz, CAMERA_POSITION_WORLD.xz);
	float keep = 1.0 - smoothstep(fade_start, fade_end, cam);

	// Offsets are in world space; bring them into the instance's local space.
	VERTEX += (inverse(mat3(MODEL_MATRIX)) * offset);
	VERTEX *= keep;

	v_tip = tip;
	float shade = 1.0 + (seed - 0.5) * 2.0 * color_variation;
	v_tint = COLOR.rgb * shade;
	// Light every blade as if it were the ground it grows on: soft, no dark back faces.
	v_up_view = normalize((VIEW_MATRIX * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
}

void fragment() {
	vec3 albedo = mix(root_color.rgb, tip_color.rgb, v_tip) * v_tint;
	albedo *= mix(1.0 - root_occlusion, 1.0, smoothstep(0.0, 0.6, v_tip));
	ALBEDO = albedo;
	NORMAL = v_up_view;
	ROUGHNESS = 0.85;
	SPECULAR = 0.25;
	BACKLIGHT = albedo * translucency * v_tip;
}
