
var fs= require('fs');

var a= fs.statSync('./videos/xxxx');
var str= '#this is a comment'
fs.readdirSync('./data').forEach(el=>{
    //console.log(el)
    str+= `\nfile './data/${el}'`;
})

console.log(str)

//ffmpeg -f concat -safe 0 -i file5.txt -c copy output.mp4
