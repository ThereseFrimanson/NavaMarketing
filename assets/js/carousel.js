// assets/js/carousel.js
(() => {
    const root = document.querySelector('.carousel');
    if (!root) return;

    const track = root.querySelector('.carousel-track');
    const speed = Number(root.dataset.speed) || 60; // px/s
    const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 1) Vänta på att alla bilder är dekodade innan mätning
    async function waitForImages() {
        const imgs = [...track.querySelectorAll('img')];
        await Promise.all(imgs.map(img => {
            if (img.complete) return img.decode?.().catch(() => { });
            return new Promise(res => {
                img.addEventListener('load', async () => { await img.decode?.().catch(() => { }); res(); }, { once: true });
                img.addEventListener('error', res, { once: true });
            });
        }));
    }

    // 2) Spara första uppsättningen (ett varv) innan vi börjar klona
    const baseItems = [...track.children];

    // 3) Mät varvsbredd (inkl. gap) – efter att bilderna är klara
    function measureLoopWidth() {
        const gap = parseFloat(getComputedStyle(track).gap || '0');
        let w = 0;
        baseItems.forEach((el, i) => {
            // använd offsetWidth (layout-bredd) för stabilitet
            w += el.offsetWidth;
            if (i < baseItems.length - 1) w += gap;
        });
        return Math.max(1, Math.round(w)); // undvik 0 / subpixeldrift
    }

    // 4) Se till att det finns >2 varv i DOM så wrap blir sömlös
    function ensureClones(minTotalWidth) {
        while (track.scrollWidth < minTotalWidth) {
            baseItems.forEach(n => track.appendChild(n.cloneNode(true)));
        }
    }

    // 5) Animation
    let loopWidth = 0;
    let offset = 0;
    let last = null;
    let playing = !prefersReduced;

    function setPlaying(v) { playing = v; }
    root.addEventListener('mouseenter', () => setPlaying(false));
    root.addEventListener('mouseleave', () => setPlaying(!prefersReduced));
    root.addEventListener('focusin', () => setPlaying(false));
    root.addEventListener('focusout', () => setPlaying(!prefersReduced));

    // Pausa när inte synlig (bättre prestanda, stabilare)
    const io = new IntersectionObserver(entries => {
        setPlaying(entries[0]?.isIntersecting && !prefersReduced);
    }, { threshold: 0 });
    io.observe(root);

    function tick(t) {
        if (last == null) last = t;
        const dt = (t - last) / 1000;
        last = t;

        if (playing && loopWidth > 0) {
            offset += speed * dt;

            // Wrap utan studs – håll alltid 0 <= offset < loopWidth
            if (offset >= loopWidth) {
                // hantera även “spikar” genom att ev. dra av flera varv
                offset = offset % loopWidth;
            }

            track.style.transform = `translate3d(${-offset}px,0,0)`;
        }
        requestAnimationFrame(tick);
    }

    let resizeTimer;
    addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const prev = loopWidth;
            loopWidth = measureLoopWidth();
            // behåll samma relativa position i nya måttet
            offset = prev > 0 ? (offset / prev % 1) * loopWidth : offset % loopWidth;
            ensureClones(loopWidth * 3 + root.clientWidth); // lite extra marginal
        }, 120);
    });

    // 6) Init – i rätt ordning
    (async () => {
        await waitForImages();                 // vänta in bilder
        loopWidth = measureLoopWidth();        // mät varvet
        ensureClones(loopWidth * 3 + root.clientWidth); // klona tills vi har gott om material
        // säkerställ att IMG inte introducerar baseline-gap (påverkar mätning i vissa teman)
        track.querySelectorAll('img').forEach(img => { img.style.display = 'block'; });
        requestAnimationFrame(tick);
    })();
})();
