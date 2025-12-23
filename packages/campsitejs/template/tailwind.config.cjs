module.exports = {
    content: [
        "./src/**/*.{html,md,njk,js,vue}",
        "./public/**/*.{html,js}"
    ],
    theme: {
        extend: {
            colors: {
                campfire: {
                    "50": "#fff0e5",
                    "100": "#ffe1cc",
                    "200": "#ffc499",
                    "300": "#ffa666",
                    "400": "#ff8833",
                    "500": "#ff6a00",
                    "600": "#cc5500",
                    "700": "#994000",
                    "800": "#662b00",
                    "900": "#331500",
                    "950": "#0a0501"
                },
                grove: {
                    ink: "#0b0c10",
                    foam: "#f4ede0",
                    glow: "#f97316",
                    forest: "#1f5130"
                }
            },
            fontFamily: {
                sans: ["Inter","system-ui","-apple-system","sans-serif"],
                mono: ["JetBrains Mono","Menlo","Consolas","monospace"]
            }
        }
    },
    plugins: []
};
