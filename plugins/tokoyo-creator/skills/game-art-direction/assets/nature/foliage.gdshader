shader_type spatial;
// Leaves of trees and bushes (alpha cut-out cards or opaque blobs), imported or built by nature_meshes.gd.
// Works on Compatibility and Forward+. Opaque pipeline: alpha scissor, no alpha blending.
render_mode cull_disabled, specular_schlick_ggx;

uniform sampler2D leaf_texture : source_color, filter_linear_mipmap, hint_default_white;
uniform vec4 shadow_color : source_color = vec4(0.10, 0.22, 0.09, 1.0);
uniform vec4 light_color : source_color = vec4(0.45, 0.66, 0.26, 1.0);
uniform float alpha_cut : hint_range(0.0, 1.0) = 0.5;
uniform float translucency : hint_range(0.0, 1.0) = 0.3;

// Crown shading: normals pointing out from this local point make the crown read as one soft volume
// instead of dozens of flat cards. 0 keeps the mesh normals (use for meshes whose normals were already
// transferred in Blender), 1 replaces them.
uniform vec3 crown_center = vec3(0.0, 3.5, 0.0);
uniform float crown_normals : hint_range(0.0, 1.0) = 0.0;

// Sway weight: COLOR.r (0 = fixed, 1 = full). Without vertex colours set use_height_weight and
// the weight grows with local height up to sway_height.
uniform bool use_height_weight = false;
uniform float sway_height = 5.0;
uniform vec2 wind_direction = vec2(1.0, 0.3);
uniform float wind_strength : hint_range(0.0, 1.0) = 0.12;
uniform float wind_speed = 1.0;

varying float v_depth;

void vertex() {
	float weight = use_height_weight ? clamp(VERTEX.y / sway_height, 0.0, 1.0) : COLOR.r;
	vec3 origin = MODEL_MATRIX[3].xyz;
	float phase = dot(origin.xz, vec2(0.37, 0.61));
	float t = TIME * wind_speed + phase;
	vec2 dir = normalize(wind_direction);
	// Slow whole-crown lean plus fast flutter that differs per leaf.
	float lean = (sin(t * 0.9) * 0.6 + 0.4) * wind_strength;
	float flutter = sin(t * 4.0 + dot(VERTEX, vec3(3.1, 1.7, 2.3))) * wind_strength * 0.25;
	vec3 lean_offset = vec3(dir.x, 0.0, dir.y) * lean * weight * weight;
	VERTEX += inverse(mat3(MODEL_MATRIX)) * lean_offset + NORMAL * flutter * weight;
	if (crown_normals > 0.0) {
		NORMAL = normalize(mix(NORMAL, normalize(VERTEX - crown_center), crown_normals));
	}
	// Inner leaves are darker: cheap self-shadowing of the crown.
	v_depth = weight;
}

void fragment() {
	vec4 tex = texture(leaf_texture, UV);
	vec3 base = mix(shadow_color.rgb, light_color.rgb, clamp(v_depth * 1.2, 0.0, 1.0));
	ALBEDO = base * tex.rgb / vec3(0.6, 0.78, 0.45) * 0.9;
	ALPHA = tex.a;
	ALPHA_SCISSOR_THRESHOLD = alpha_cut;
	ROUGHNESS = 0.8;
	SPECULAR = 0.3;
	BACKLIGHT = ALBEDO * translucency;
	// cull_disabled flips back-face normals; keep crown normals facing outward for both sides.
	if (!FRONT_FACING && crown_normals > 0.0) {
		NORMAL = -NORMAL;
	}
}
