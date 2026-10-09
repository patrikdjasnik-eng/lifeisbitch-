import pathlib,subprocess,concurrent.futures,json,hashlib,sys
root=pathlib.Path(__file__).resolve().parents[1]
sourceDir=pathlib.Path(sys.argv[1])
(root/'web/audio').mkdir(parents=True,exist_ok=True)
tracks=[('tension','Tension In The Air','Holizna','oldschool','mp3'),('cobwebs','CobWebs','Holizna','oldschool','mp3'),('haunted','Haunted Houses','Holizna','oldschool','mp3'),('gichco','Prophesy of Domination','Gichco','oldschool','mp3'),('zizkov-afterhours','Žižkov Afterhours','Street Life / Holizna melodies','cloud','wav'),('vinohrady-clouds','Vinohrady Clouds','Street Life / Holizna melodies','cloud','wav'),('nocni-linka','Noční linka','Street Life / Holizna melodies','cloud','wav')]
def encode(track):
 name,title,artist,pack,ext=track
 out=root/'web/audio'/f'{name}.mp3'
 subprocess.run(['ffmpeg','-v','error','-y','-i',str(sourceDir/f'{name}.{ext}'),'-map','0:a:0','-map_metadata','-1','-af','loudnorm=I=-18:TP=-1.5:LRA=11','-ar','44100','-ac','2','-codec:a','libmp3lame','-b:a','112k','-metadata',f'title={title}','-metadata',f'artist={artist}',str(out)],check=True)
 duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(out)]))
 return dict(title=title,artist=artist,pack=pack,file=f'audio/{name}.mp3',duration=round(duration,2),bytes=out.stat().st_size,sha256=hashlib.sha256(out.read_bytes()).hexdigest(),rights='CC0' if pack=='oldschool' else 'CC0 melodie · vlastní aranžmá')
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 result=list(pool.map(encode,tracks))
(root/'web/radio-tracks.js').write_text('window.streetRadioTracks = '+json.dumps(result,ensure_ascii=False,indent=2)+';\n')
print(json.dumps(result,ensure_ascii=False,indent=2))
