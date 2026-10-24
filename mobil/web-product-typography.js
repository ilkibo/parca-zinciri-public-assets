// Presentation only: shared website markup, data and actions stay canonical.
export const webProductTypography = `
:host{--sans:'PZ Manrope',system-ui,sans-serif;--display:var(--sans);--mono:var(--sans);font-size:16px;font-weight:400;line-height:1.6;font-synthesis:none}
.content{font-size:15px;line-height:1.65}
.title{font-family:var(--sans);font-size:clamp(27px,5vw,34px);font-weight:300;font-stretch:normal;letter-spacing:-.045em;line-height:1.15;text-transform:none}
h2,.section h2{font-family:var(--sans);font-size:26px;font-weight:350;letter-spacing:-.035em;line-height:1.25;margin:0 0 16px}
h3,.section h3,.empty h3{font-family:var(--sans);font-size:18px;font-weight:450;letter-spacing:-.02em;line-height:1.35;text-transform:none}
.sub,.help{font-size:13px;font-weight:400;line-height:1.55}
.top .sub{font-size:12px;margin-top:6px}
.field label,.metric .k,.card .k,th,.kv .k{font-family:var(--sans);font-size:13px;font-weight:500;letter-spacing:0;text-transform:none}
.field input,.field select,.field textarea{font-family:var(--sans);font-size:16px;font-weight:400}
.btn,.nav-add,.nav-list button,.menu,.filters button,.theme-switch button{font-family:var(--sans);font-weight:500;font-size:14px;letter-spacing:0;text-transform:none;font-stretch:normal}
.theme-switch label{font-size:14px;font-weight:450}
.metric .v,.content>section>.grid>.card>strong{display:block;font-family:var(--sans);font-size:34px;font-weight:300;letter-spacing:-.045em;font-stretch:normal;font-variant-numeric:tabular-nums;line-height:1.2;margin-top:8px}
strong,b{font-weight:550}.chip{font-family:var(--sans);font-weight:450;letter-spacing:0;text-transform:none}
.pz-pricing{font-family:var(--sans);font-size:15px}.pz-pricing h2{font-size:25px;font-weight:350}.pz-pricing h3{font-size:18px;font-weight:450}.pz-pricing label,.pz-pricing dd{font-weight:500}.pz-pricing .pr-total{font-size:32px;font-weight:300;letter-spacing:-.04em}
.brand-text{font-family:var(--sans);font-stretch:normal}.brand-text small{font-size:11px;font-weight:400;letter-spacing:.06em}
@media(max-width:600px){.top{gap:10px;padding:14px}.title{font-size:28px}.top>div:first-child{align-items:center}.content{padding:24px 16px 32px}.content>section>.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.content>section>.grid>.card{font-size:13px}.content>section>.grid>.card>strong{font-size:32px}}
`;
