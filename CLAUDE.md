# DebtPilot - Project Documentation

## Project Overview
DebtPilot adalah dashboard monitoring pembayaran hutang pribadi dengan login tunggal.

**Status:** Active Development - Quality Optimization Phase

## Tech Stack
- **Frontend:** Vanilla JavaScript (akan dipertahankan, optimization only)
- **Styling:** Vanilla CSS
- **Charts:** SVG-based (custom implementation)
- **Storage:** LocalStorage + SessionStorage
- **Auth:** Single username/password in-app

## Current Features
✅ Login dengan validasi  
✅ Dashboard dengan 3 tipe grafik (donut, line, bar)  
✅ Update pembayaran form  
✅ Debt details table  
✅ Payment history dengan filter & search  
✅ Settings panel  
✅ Responsive design  
✅ Toast notifications  
✅ Modal untuk edit pembayaran  

## Improvement Priorities
1. **Code Refactoring** — Split into modules
2. **Bug Fixes** — Modal pre-fill, form validation
3. **UX Enhancement** — Better visual feedback, clearer flow
4. **Performance** — Optimize renders, reduce DOM manipulation
5. **Features** — Sorting, analytics insights, better charts

## Known Issues
- Modal form tidak pre-fill correctly untuk edit payment
- Perlu validation untuk payment amount > remaining debt
- Perlu konfirmasi delete dari modal
- Code size terlalu besar (865 lines)

## File Structure
```
/
├── index.html
├── app.js          (akan di-refactor)
├── styles.css      (akan di-enhance)
└── CLAUDE.md       (docs)
```

## Development Notes
- Data dummy untuk 6 platform sudah ada
- Format mata uang: IDR (Rupiah Indonesia)
- Tanggal format: DD Mmmm YYYY
- Responsive breakpoints: 1180px, 900px, 640px
