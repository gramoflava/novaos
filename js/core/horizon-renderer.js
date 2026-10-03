// High-resolution canopy. The CPU still integrates the Schwarzschild photon
// paths; WebGL only looks up those paths and shades their disc/sky crossings.
// Spatial, pixel-footprint AA replaces the old blurred frame accumulation.
class HorizonGPU {
    constructor(view) {
        this.canvas = document.createElement('canvas');
        const gl = this.canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
        if (!gl) throw new Error('WebGL2 unavailable');
        this.gl = gl;
        this.lost = false;
        this.canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.lost = true; });
        this.textures = [];
        this.shaders = [];
        this.timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
        this.pending = null;
        this.quality = 1;
        this.qualityAt = 0;
        try {
            const shader = (type, source) => {
                const s = gl.createShader(type);
                this.shaders.push(s);
                gl.shaderSource(s, source); gl.compileShader(s);
                if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
                return s;
            };
            this.program = gl.createProgram();
            gl.attachShader(this.program, shader(gl.VERTEX_SHADER, `#version 300 es
                void main() {
                    vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
                    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
                }`));
            gl.attachShader(this.program, shader(gl.FRAGMENT_SHADER, this.constructor.fragment));
            gl.linkProgram(this.program);
            if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program));
            gl.useProgram(this.program);
            this.uniforms = {};
            for (const name of ['size', 'path', 'ends', 'count', 'stepPhi', 'camera', 'rho', 'zenith', 'time', 'base', 'logG', 'fall', 'discTime', 'smear', 'starsAlive', 'discAlive']) {
                this.uniforms[name] = gl.getUniformLocation(this.program, name);
            }
            for (let i = 0; i < 2; i++) {
                const tex = gl.createTexture(); this.textures.push(tex);
                gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            }
            gl.uniform1i(this.uniforms.path, 0); gl.uniform1i(this.uniforms.ends, 1);
            this.paths = new Float32Array(view.NA * view.S * 2);
            this.ends = new Float32Array(view.NA * 2);
        } catch (e) { this.dispose(); throw e; }
    }

    upload(v) {
        if (this.key === v.tableKey) return;
        const gl = this.gl;
        for (let i = 0; i < v.rows.length; i++) {
            this.paths[i * 2] = v.rows[i]; this.paths[i * 2 + 1] = v.ws[i];
        }
        for (let i = 0; i < v.NA; i++) {
            this.ends[i * 2] = v.end[i];
            this.ends[i * 2 + 1] = Number.isFinite(v.esc[i]) ? v.esc[i] : -1;
        }
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.textures[0]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, v.S, v.NA, 0, gl.RG, gl.FLOAT, this.paths);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.textures[1]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, v.NA, 1, 0, gl.RG, gl.FLOAT, this.ends);
        if (gl.getError() !== gl.NO_ERROR) this.lost = true;
        this.key = v.tableKey;
    }

    render(v, w, h, st, time, camera) {
        if (this.lost) return null;
        const gl = this.gl, u = this.uniforms;
        // Read GPU timings only when ready; never block with readPixels/finish.
        // Low-end hardware gets a smaller pixel budget, not a longer frame queue.
        if (this.pending && gl.getQueryParameter(this.pending, gl.QUERY_RESULT_AVAILABLE)) {
            if (!gl.getParameter(this.timer.GPU_DISJOINT_EXT)) {
                const ms = gl.getQueryParameter(this.pending, gl.QUERY_RESULT) / 1e6;
                this.ms = this.ms ? this.ms * 0.85 + ms * 0.15 : ms;
                if (time > this.qualityAt) {
                    if (this.ms > 11) this.quality = Math.max(0.55, this.quality - 0.08);
                    else if (this.ms < 5) this.quality = Math.min(1, this.quality + 0.04);
                    this.qualityAt = time + 0.75;
                }
            }
            gl.deleteQuery(this.pending); this.pending = null;
        }
        // At most ~one million shaded pixels, even on a 3× phone display.
        const scale = Math.min(1, 1440 / w, Math.sqrt(1000000 / (w * h))) * this.quality;
        w = Math.max(1, Math.round(w * scale)); h = Math.max(1, Math.round(h * scale));
        if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
        gl.viewport(0, 0, w, h); gl.useProgram(this.program);
        this.upload(v);
        if (this.lost) return null;
        gl.uniform2f(u.size, w, h); gl.uniform1i(u.count, v.NA); gl.uniform1f(u.stepPhi, v.H);
        gl.uniform2f(u.camera, Math.cos(camera.ac), Math.sin(camera.ac));
        gl.uniform1f(u.rho, st.rho); gl.uniform1i(u.zenith, camera.zenith ? 1 : 0);
        gl.uniform1f(u.time, time); gl.uniform3fv(u.base, v.base.map(c => c / 255));
        // log10 of the shift of light from far away, as the pilot measures it
        // (see Horizon.fallState for the free fall). Logs keep 10²² in range.
        gl.uniform1f(u.logG, st.logG !== undefined ? st.logG : Math.log10(st.gObs));
        gl.uniform1f(u.fall, st.fall || 0);
        gl.uniform1f(u.discTime, st.discTime !== undefined ? st.discTime : time);
        gl.uniform1f(u.smear, Math.min(1e30, st.smear || 0));
        gl.uniform1f(u.starsAlive, st.starsAlive !== undefined ? st.starsAlive : 1);
        gl.uniform1f(u.discAlive, st.discAlive !== undefined ? st.discAlive : 1);
        const measure = this.timer && !this.pending;
        if (measure) { this.pending = gl.createQuery(); gl.beginQuery(this.timer.TIME_ELAPSED_EXT, this.pending); }
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (measure) gl.endQuery(this.timer.TIME_ELAPSED_EXT);
        return this.canvas;
    }

    dispose() {
        const gl = this.gl;
        if (!gl) return;
        for (const tex of this.textures) gl.deleteTexture(tex);
        for (const s of this.shaders) gl.deleteShader(s);
        if (this.program) gl.deleteProgram(this.program);
        if (this.pending) gl.deleteQuery(this.pending);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        this.paths = this.ends = null;
        this.gl = null;
    }

    static get fragment() {
        return `#version 300 es
        precision highp float;
        precision highp int;
        uniform vec2 size, camera;
        uniform sampler2D path, ends;
        uniform int count, zenith;
        uniform float stepPhi, rho, time, logG, fall, discTime, smear, starsAlive, discAlive;
        uniform vec3 base;
        out vec4 colour;
        const float PI = 3.14159265359;
        const float SB = 0.1218693434, CB = 0.9925461516;

        vec2 meta(int row) { return texelFetch(ends, ivec2(row, 0), 0).rg; }
        vec2 at(int row, float phi) {
            if (phi >= meta(row).x) return vec2(-1.0, 0.0);
            float f = phi / stepPhi;
            int i = int(floor(f));
            return mix(texelFetch(path, ivec2(i, row), 0).rg,
                       texelFetch(path, ivec2(i + 1, row), 0).rg, fract(f));
        }
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

        float starLayer(vec2 angular, float cellSize, float density, bool bright) {
            vec2 uv = angular / cellSize;
            vec2 cell = floor(uv), pos = fract(uv);
            vec2 footprint = max(fwidth(uv), vec2(0.00027 / cellSize));
            // Both populations have the SAME angular point-spread profile;
            // the sparse population has greater flux, not larger stars.
            float sourceVariance = pow(0.00072 / cellSize, 2.0);
            float meanPeak = bright ? 160.0 + 880.0 / 9.0 : 1.0;
            float meanLight = 2.0 * PI * sourceVariance * density * meanPeak;
            float unresolved = smoothstep(0.65, 1.5, max(footprint.x, footprint.y));
            // A 3x3 neighbourhood cannot integrate a footprint spanning many
            // cells. Its ensemble mean retains their light instead of losing it.
            if (unresolved >= 1.0) return meanLight;
            float star = 0.0;
            for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
                vec2 offset = vec2(float(x), float(y)), id = cell + offset;
                float seed = hash(id);
                if (seed < density) {
                    float seed2 = hash(id + 39.7);
                    vec2 centre = offset + vec2(0.2 + 0.6 * seed / density, 0.2 + 0.6 * seed2);
                    vec2 d = pos - centre;
                    vec2 variance = vec2(sourceVariance) + footprint * footprint / 12.0;
                    float energy = sourceVariance / sqrt(variance.x * variance.y);
                    float peak = bright ? 160.0 + 880.0 * pow(seed2, 8.0) : 0.5 + seed2;
                    star += peak * energy * exp(-0.5 * dot(d * d, 1.0 / variance));
                }
            }
            return mix(star, meanLight, unresolved);
        }

        vec3 sky(vec3 direction) {
            float lat = asin(clamp(direction.x, -1.0, 1.0));
            float lon = atan(direction.z, direction.y);
            vec2 angular = vec2(lat + 1.6, (lon + PI) * cos(lat));
            float star = starLayer(angular, 0.018, 0.10, false)
                       + starLayer(angular, 0.25, 0.50, true);
            float band = 0.045 * starsAlive * exp(-pow(dot(direction, vec3(0.3, 0.5, 0.81)), 2.0) / 0.03);
            // blue-white when blueshifted, deep red and dimmer (I ∝ g⁴) when redshifted
            vec3 tint = logG >= 0.0 ? mix(vec3(0.90, 0.93, 0.98), vec3(0.63, 0.77, 0.98), min(1.0, logG / 4.0))
                                    : mix(vec3(0.90, 0.93, 0.98), vec3(1.0, 0.34, 0.20), min(1.0, -logG / 1.5));
            float dim = logG < 0.0 ? pow(10.0, 4.0 * logG) : 1.0;
            float exposure = 1.4 + 1.1 * clamp(logG / 5.0, 0.0, 1.0);
            return tint * dim * (0.008 + band + min(1.0, star * exposure * starsAlive));
        }

        void main() {
            vec2 p = (2.0 * gl_FragCoord.xy - size) / size.x;
            // Angular camera drift, not enlargement of a frozen screenshot.
            p += vec2(0.075 * sin(fall * 1.8), -0.06 * fall * fall);
            float roll = 0.10 * fall * fall;
            p = mat2(cos(roll), -sin(roll), sin(roll), cos(roll)) * p;
            float rr = length(p), fa;
            vec2 e2;
            if (zenith == 0) {
                float th = rr * 1.082104136;
                if (th > PI) { colour = vec4(0.0, 0.0, 0.0, 1.0); return; }
                vec3 d = vec3(-camera.x, camera.y, 0.0) * cos(th)
                       + vec3(camera.y * p.y, camera.x * p.y, p.x) * (rr > 0.000001 ? sin(th) / rr : 0.0);
                fa = acos(clamp(-d.x, -1.0, 1.0)) / PI * float(count - 1);
                e2 = normalize(d.yz + vec2(1e-12));
            } else {
                // Local Lorentz aberration: tan(theta'/2) = boost*tan(theta/2).
                // This is a cinematic camera/velocity path; the geodesic LUT
                // remains the exterior, near-horizon limit, not an interior ray trace.
                float velocity = 0.995 * smoothstep(0.0, 1.0, fall);
                float boost = sqrt((1.0 + velocity) / (1.0 - velocity));
                if (rr * 0.54 >= PI * 0.5) { colour = vec4(0.0, 0.0, 0.0, 1.0); return; }
                float q = 2.0 * atan(tan(rr * 0.54) / boost) / (rho * 1.08);
                fa = q / 1.25 * float(count - 1);
                e2 = normalize(vec2(-p.y, p.x) + vec2(1e-12));
            }
            if (fa > float(count - 1)) { colour = vec4(0.0, 0.0, 0.0, 1.0); return; }
            int r0 = int(floor(fa)), r1 = min(count - 1, r0 + 1);
            float weight = fract(fa);
            vec3 n = vec3(SB, CB, 0.0);
            float phi = atan(-n.x, n.y * e2.x);
            if (phi <= 0.001) phi += PI;
            float remain = 1.0;
            vec3 light = vec3(0.0);
            for (int k = 0; k < 3; k++, phi += PI) {
                vec2 a = at(r0, phi), b = at(r1, phi);
                if (a.x < 0.0 && b.x < 0.0) break;
                vec2 samplePath = a.x < 0.0 ? b : b.x < 0.0 ? a : mix(a, b, weight);
                float r = samplePath.x;
                float aa = min(0.25, max(0.015, fwidth(r)));
                float cover = smoothstep(3.0 - aa, 3.18 + aa, r) * (1.0 - smoothstep(8.4, 10.0 + aa, r));
                if (a.x < 0.0 || b.x < 0.0) cover *= a.x < 0.0 ? weight : 1.0 - weight;
                if (cover <= 0.0) continue;
                float cp = cos(phi), sp = sin(phi);
                vec3 position = vec3(cp, sp * e2);
                vec3 orbit = normalize(cross(n, position));
                // local static frame: radial component is (dr/dφ)/√(1−1/r)
                float rp = -r * r * samplePath.y / sqrt(1.0 - 1.0 / r);
                vec3 photon = normalize(-vec3(rp * cp - r * sp, (rp * sp + r * cp) * e2));
                float v = sqrt(0.5 / (r - 1.0));
                float dop = sqrt(1.0 - v * v) / (1.0 - v * dot(orbit, photon));
                float localG = sqrt(1.0 - 1.0 / r) * dop;
                float az = atan(position.z, position.x * CB - position.y * SB);
                // The gas orbits in home time; when it turns several radians
                // per frame its structure averages into a smooth ring.
                float kep = pow(r / 3.0, -1.5);
                float orbitalTime = discTime * 2.2 * kep;
                float sharp = 1.0 - smoothstep(0.6, 3.0, smear * kep);
                // Differential rotation and radial filaments read as flowing
                // gas. Band-limit the fine layer rather than blur the whole scene.
                float phase = az * 17.0 - 11.0 * r - orbitalTime * 1.7;
                float fine = 1.0 - smoothstep(0.6, 2.5, fwidth(phase));
                float filament = az * 31.0 + 36.0 * log(r) - orbitalTime * 2.3;
                float filamentAA = 1.0 - smoothstep(0.6, 2.5, fwidth(filament));
                float flow = 0.58 + sharp * (0.23 * sin(az * 6.0 + 7.0 * log(r) - orbitalTime)
                           + 0.13 * fine * sin(phase) + 0.06 * filamentAA * sin(filament));
                float emission = pow(3.0 / r, 3.0) * (1.0 - sqrt(3.0 / r) * 0.92) * 9.0 * flow * discAlive;
                // Exposure compensates only the common observer blueshift;
                // gravitational/Doppler asymmetry and g^4 radiance stay intact.
                float shiftDim = logG < 0.0 ? pow(10.0, 4.0 * logG) : min(2.0, 1.0 + logG * 0.12);
                float intensity = emission * pow(localG, 4.0) * shiftDim / (1.0 + float(k) * 0.6);
                float luminance = 1.0 - exp(-intensity * 4.0);
                // Compressed false colour: huge spectral shifts exceed any
                // display gamut, but still progress from warm to blue-white.
                float lg = log2(max(0.001, localG)) + clamp(logG * 0.60, -6.0, 4.5);
                vec3 tint = lg > 0.0 ? mix(base, vec3(0.78, 0.88, 1.0), min(0.85, lg / 3.6))
                                    : mix(base, vec3(1.0, 0.20, 0.09), min(1.0, -lg / 1.8));
                light += tint * luminance * cover * remain;
                remain *= 1.0 - cover;
            }
            vec2 m0 = meta(r0), m1 = meta(r1);
            if (remain > 0.01 && (m0.y >= 0.0 || m1.y >= 0.0)) {
                // Interpolate escape directions only within the same branch;
                // never blur an escaping ray across the captured-ray boundary.
                float pf = m0.y < 0.0 ? m1.y : m1.y < 0.0 ? m0.y : mix(m0.y, m1.y, weight);
                float coverage = m0.y < 0.0 ? weight : m1.y < 0.0 ? 1.0 - weight : 1.0;
                light += sky(vec3(cos(pf), sin(pf) * e2)) * remain * coverage;
            }
            // The physics dims the view in the fall (g⁴); this only closes the
            // last moments to black before the flash.
            light *= 1.0 - smoothstep(0.90, 1.0, fall);
            colour = vec4(light, 1.0);
        }`;
    }
}
