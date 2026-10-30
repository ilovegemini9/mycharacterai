import type { KnowledgeRecord } from "../types";

export const phoneNotCharging: KnowledgeRecord = {
  id: "phone-not-charging",
  intent: "fix",
  title: "Phone Won't Charge",
  slug: "/fix/phone-not-charging",
  aliases: ["phone isn't charging", "phone not charging", "phone won't charge", "phone charging slowly", "phone only charges at an angle", "iphone won't charge", "my iphone won't charge", "android phone won't charge"],
  answer: "Start with the cable, charger, outlet, and charging port before assuming the battery is bad. Most charging problems can be narrowed down with a few safe checks.",
  causes: ["Damaged cable or power adapter", "Debris, moisture, or damage in the charging port", "A software or charging-system fault", "A worn or failing battery", "A damaged charging port or internal hardware"],
  steps: ["Try a known-good cable, charger, and wall outlet. If possible, test the same charger with another compatible device.", "Inspect the charging port with a light. If you see lint or debris, follow the manufacturer's cleaning guidance; do not insert metal objects or force anything into the port.", "If the phone shows a moisture warning, disconnect it and follow the manufacturer's drying guidance rather than trying to charge through the warning.", "Restart the phone and try charging again. If it is completely unresponsive, leave it connected to a known-good charger for a short period before trying to power it on.", "If charging works only when the cable is held at an angle, stop stressing the connector and have the port inspected.", "If the problem continues with known-good charging equipment, check the manufacturer's support guidance or arrange professional repair."],
  warnings: ["If the phone or battery is swollen, unusually hot, smoking, leaking, or physically damaged, stop using and charging it and seek professional help.", "Do not use metal tools, force debris deeper into the port, or puncture a battery."],
  whenToGetHelp: ["The device becomes unusually hot while charging.", "The battery appears swollen or physically damaged.", "The charging port is loose, damaged, or only works in one position.", "The phone repeatedly stops charging despite known-good cables, chargers, and outlets."],
  factors: ["Whether another cable and charger work", "Whether the phone shows a moisture or temperature warning", "Whether the port looks damaged or obstructed", "Whether wireless charging works when supported", "Whether the problem began after a drop, liquid exposure, or software update"],
  sources: [
    { label: "Google Android Help — Fix a device that won't charge or turn on", url: "https://support.google.com/android/answer/7662405" },
    { label: "Google Pixel Help — Fix a Pixel phone that won't charge or turn on", url: "https://support.google.com/pixelphone/answer/7167687" },
    { label: "Apple Support — If your iPhone or iPod touch won't charge", url: "https://support.apple.com/en-us/HT201569" },
  ],
  related: ["/decide/repair-or-replace", "/cost/electricity-cost"],
  seo: { indexable: true, title: "Phone Won't Charge: Causes & Safe Troubleshooting | Vorqena", description: "Work through safe checks for a phone that will not charge, from the cable and outlet to the charging port, warnings, and repair." }
};
