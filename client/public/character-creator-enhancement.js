(function(){
  const FORM_MARK='data-character-creator-enhanced';
  const FINISH_KEY='__mycharacterCreatorFinish';
  const examples={
    name:'e.g. Albert Einstein',hook:'e.g. A detective who solves cases before they happen.',
    desc:'e.g. A retired pirate queen now runs a cozy seaside inn, but trouble is never far away.',
    greeting:'e.g. You took your time. I was waiting for you.',
    definition:'e.g. Always use formal, poetic language. Avoid contractions. Never lie.'
  };
  function setNative(el,value){
    if(!el)return;
    const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
    const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;
    setter?.call(el,value);
    el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function originalFields(form){
    const all=[...form.querySelectorAll('input,textarea,select')];
    return {
      name:all.find(e=>e.tagName==='INPUT'&&e.type==='text')||all.find(e=>e.tagName==='INPUT'),
      desc:all.find(e=>e.tagName==='TEXTAREA'&&/concise|introduction/i.test(e.placeholder||'')),
      role:all.find(e=>e.tagName==='INPUT'&&/last star|tagline/i.test(e.placeholder||'')),
      tag:all.find(e=>e.tagName==='SELECT'),
      personality:all.find(e=>e.tagName==='TEXTAREA'&&/traits|tone of voice/i.test(e.placeholder||'')),
      backstory:all.find(e=>e.tagName==='TEXTAREA'&&/important history/i.test(e.placeholder||'')),
      scenario:all.find(e=>e.tagName==='TEXTAREA'&&/where does the story/i.test(e.placeholder||'')),
      greeting:all.find(e=>e.tagName==='TEXTAREA'&&/first message/i.test(e.placeholder||'')),
      exampleDialogue:all.find(e=>e.tagName==='TEXTAREA'&&/Character: \.\.\./i.test(e.placeholder||'')),
      characterRules:all.find(e=>e.tagName==='TEXTAREA'&&/always do or avoid/i.test(e.placeholder||'')),
      visibility:all.find(e=>e.tagName==='SELECT'&&[...e.options].some(o=>/listed in Discover/i.test(o.text)))
    };
  }
  function enhance(modal){
    const form=modal.querySelector('form');
    const head=modal.querySelector('.modal-head');
    if(!form||!head||form.getAttribute(FORM_MARK)==='1')return;
    if(!(head.querySelector('.eyebrow')?.textContent||'').includes('CHARACTER CREATOR'))return;
    form.setAttribute(FORM_MARK,'1');
    const fields=originalFields(form);
    Object.values(fields).forEach(el=>{if(el)el.style.display='none'});
    const progress=head.querySelector('.wizard-progress');if(progress)progress.style.display='none';
    const stepTitle=head.querySelector('h2');if(stepTitle)stepTitle.textContent='Create a character';
    const stepDesc=head.querySelector('p');if(stepDesc)stepDesc.textContent='Give your character a clear identity, voice, and world.';
    const close=head.querySelector('button[aria-label="Close"]');
    const shell=document.createElement('div');
    shell.className='creator-form-enhanced';
    shell.innerHTML=`
      <div class="creator-field"><label>Character name <span class="required">*</span></label><input data-field="name" maxlength="20" placeholder="${examples.name}"><span class="counter" data-count="name">0/20</span></div>
      <div class="creator-field"><label>Tagline</label><input data-field="hook" maxlength="50" placeholder="${examples.hook}"><span class="counter" data-count="hook">0/50</span></div>
      <div class="creator-field"><label>Description</label><textarea data-field="desc" maxlength="500" placeholder="${examples.desc}"></textarea><span class="counter" data-count="desc">0/500</span></div>
      <div class="creator-field"><label>Greeting</label><textarea data-field="greeting" maxlength="4096" placeholder="${examples.greeting}"></textarea><span class="counter" data-count="greeting">0/4096</span></div>
      <div class="creator-toggle-row"><div><strong>AI-generated greetings for new chats</strong><small>Let the character vary the opening message for new conversations.</small></div><button type="button" class="creator-switch" data-ai="1" aria-pressed="false"><span></span></button></div>
      <div class="creator-field"><label>Voice</label><select data-field="voice"><option>Default</option><option>Warm</option><option>Calm</option><option>Energetic</option><option>Deep</option><option>Soft</option></select></div>
      <div class="creator-section"><div class="creator-section-title"><strong>Lorebook</strong><span>New!</span></div><p>World-building information you can share dynamically with the character when certain keywords are mentioned.</p><textarea data-field="lorebook" maxlength="8000" placeholder="Add places, people, events, facts, or keywords that should be remembered in the world."></textarea></div>
      <div class="creator-field"><label>Tags</label><input data-field="tags" placeholder="e.g. Anime, Fantasy, Roleplay"><small>Add search tags separated by commas.</small></div>
      <div class="creator-field"><label>Definition</label><textarea data-field="definition" maxlength="32000" placeholder="${examples.definition}"></textarea><span class="counter" data-count="definition">0/32000</span></div>
      <div class="creator-toggle-row"><div><strong>Keep character definition private</strong><small>Only you can view the definition used to guide the character.</small></div><button type="button" class="creator-switch on" data-private="1" aria-pressed="true"><span></span></button></div>
      <div class="creator-field"><label>Visibility</label><select data-field="visibility"><option value="public">Public</option><option value="unlisted">Unlisted</option><option value="private">Private</option></select></div>
      <div class="creator-hidden-fields"></div>
      <div class="creator-form-actions"><button type="button" class="secondary-btn" data-cancel>Cancel</button><button type="submit" class="primary-btn">Create character</button></div>`;
    const oldChildren=[...form.children];
    shell.querySelector('.creator-hidden-fields').append(...oldChildren);
    form.replaceChildren(shell);
    if(close)head.appendChild(close);
    const bind=(key,target)=>{
      const el=shell.querySelector(`[data-field="${key}"]`);if(!el)return;
      if(target)el.value=target.value||'';
      const update=()=>{if(target)setNative(target,el.value);const counter=shell.querySelector(`[data-count="${key}"]`);if(counter)counter.textContent=`${el.value.length}/${el.maxLength}`};
      el.addEventListener('input',update);el.addEventListener('change',update);update();
    };
    bind('name',fields.name);bind('desc',fields.desc);bind('greeting',fields.greeting);bind('definition',fields.personality);
    bind('visibility',fields.visibility);
    const hook=shell.querySelector('[data-field="hook"]');hook.addEventListener('input',()=>fields.role&&setNative(fields.role,hook.value));
    const tags=shell.querySelector('[data-field="tags"]');tags.addEventListener('input',()=>{if(!fields.tag)return;const wanted=tags.value.split(',')[0]?.trim();const opt=[...fields.tag.options].find(o=>o.text.toLowerCase()===wanted?.toLowerCase());if(opt)setNative(fields.tag,opt.value)});
    const lore=shell.querySelector('[data-field="lorebook"]');lore.addEventListener('input',()=>fields.backstory&&setNative(fields.backstory,lore.value));
    shell.querySelectorAll('.creator-switch').forEach(btn=>btn.addEventListener('click',()=>{btn.classList.toggle('on');btn.setAttribute('aria-pressed',String(btn.classList.contains('on')))}));
    shell.querySelector('[data-cancel]').addEventListener('click',()=>close?.click());
    form.addEventListener('submit',e=>{
      e.preventDefault();e.stopImmediatePropagation();
      const required=shell.querySelector('[data-field="name"]');if(!required.value.trim()){required.focus();return;}
      if(fields.personality)setNative(fields.personality,shell.querySelector('[data-field="definition"]').value);
      if(fields.backstory)setNative(fields.backstory,lore.value);
      window[FINISH_KEY]=true;
      const next=[...form.querySelectorAll('button')].find(b=>/^Continue/i.test((b.textContent||'').trim()));
      if(next)next.click();
    },true);
  }
  function finishStep(){
    if(!window[FINISH_KEY])return;
    const modal=[...document.querySelectorAll('.modal')].find(m=>(m.querySelector('.eyebrow')?.textContent||'').includes('CHARACTER CREATOR'));
    const form=modal?.querySelector('form');if(!form)return;
    const buttons=[...form.querySelectorAll('button')];
    const next=buttons.find(b=>/^Continue/i.test((b.textContent||'').trim()));
    const create=buttons.find(b=>/^Create character/i.test((b.textContent||'').trim()));
    setTimeout(()=>{if(next)next.click();else if(create){window[FINISH_KEY]=false;create.click()}},80);
  }
  const observer=new MutationObserver(()=>{const modal=[...document.querySelectorAll('.modal')].find(m=>(m.querySelector('.eyebrow')?.textContent||'').includes('CHARACTER CREATOR'));if(modal){enhance(modal);finishStep()}});
  observer.observe(document.body,{subtree:true,childList:true});
})();
