var request= require('request');

var cheerio= require('cheerio');

String.prototype.GetValue2 = function(para) {
    let reg = new RegExp("(^|&)" + para + "=([^&]*)(&|$)");
    let r = this.substr(this.indexOf("\?") + 1).match(reg);
    if (r != null) return (r[2]);
    return null;
}
const HOST_BASIC= 'https://mbasic.facebook.com';
const headers= require('./cookie').headers;
//const id= '';
function getlistImages(opt, cb){
    var id= ''+ opt.id;
    request.get({
        url: (opt.id) ? 'https://mbasic.facebook.com/'+ id+ '/photos' : opt.url,
        headers
    }, function(err, resp, body){
        if(resp && resp.statusCode!=200) require('fs').writeFileSync('./hack/test2.html', body)
        if(resp && resp.statusCode!=200) err= err|| {message: 'cookie expire'};
        if(err) return cb(err);
        var $= cheerio.load(body);
        if(opt.open1) return cb(null, $);
        var data= {next: '', images: [], videos: []};
        //var a = $("div[style^='text-align:center']").eq(0);
        $('#root>table>tbody>tr>td>div>a').each(function(i, el){
            var a= $(this).attr('href');
            if(a.includes('/photos/')) data.images.push(HOST_BASIC+ a);
        })
        data.next= HOST_BASIC+ $('#m_more_item a').eq(0).attr('href');
        cb(null, data);
    })
}

function getdetail(opt, cb){
    request.get({
        url: opt.url,
        headers
    }, function(err, resp, body){
        if(resp && resp.statusCode!=200) err= err|| {message: 'cookie expire'};
        if(err) return cb(err);
        var $= cheerio.load(body);
        var data= {thumb: [], origin: ''};
        $('#objects_container img').each(function(i, el){
            var a= $(this).attr('src');
            if(!a.includes('/static.xx.fbcdn.net/')) data.thumb.push(a);
        })
        data.origin= data.thumb[0];
    
        var a= $('div#m_story_permalink_view > div').html();
        if(a){
            var idx1= a.indexOf('/video_redirect/');
            a= a.substring(idx1, a.indexOf('\"', idx1));
            a= HOST_BASIC+ a;
            data.video= a;
        }
        cb(null, data);
    })
}

async function download(x, name, dirPath){
    return new Promise(function(solve){
        const fs= require('fs');
        const dir= __dirname+ '/images/'+ dirPath;
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir);
        }
        require('request').get({
            url: x,
            headers
        })
        .on('error', function(err){
            solve({err});
        })
        .pipe(require('fs').createWriteStream(dir+ '/image_'+ name+ '.jpg'))
        .on('close', function(){
            solve({data: 1})
        })
    })
}

async function download2(x, name, dirPath){
    return new Promise(function(solve){
        const fs= require('fs');
        const dir= __dirname+ '/videos/'+ dirPath;
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir);
        }
        require('request').get({
            url: x,
            headers
        })
        .on('error', function(err){
            solve({err});
        })
        .pipe(require('fs').createWriteStream(dir+ '/image_'+ name+ '.mp4'))
        .on('close', function(){
            solve({data: 1})
        })
    })
}

async function getdetailPromise(opt){
    return new Promise(function(solve){
        getdetail(opt, function(err, data){
            if(err) return solve({err});
            //console.log(data.origin);
            return solve({data: data.origin});
        })
    })
}
const database= require('./database.json');
// console.log({database})
function save(){
    require('fs').writeFileSync('./database.json', JSON.stringify(database));
}
var bug= 0;
function scanImages(opt){
    var turl= (opt.id) ? 'https://mbasic.facebook.com/'+ opt.id+ '/photos' : opt.url;
    if(!turl.includes('/photoset/pb.')){
        getlistImages({
            url: opt.url,
            id: opt.id,
            open1: true
        }, function(err, $){
            if(!err) {
                var x= $("a[href*='/photoset/pb.']").attr('href');
                if(x){
                    x= HOST_BASIC+ x;
                    return scanImages({url: x});
                }
            }
        })
        return;
    }
    getlistImages({url: opt.url}, function(er, dat){
        if(er) return console.error(er);
        var xPath= opt.id || opt.url.GetValue2('owner_id');
        console.log({xPath});
        (async function(){
            if(dat.images.length>0){
                for(var i in dat.images){
                    var el= dat.images[i] || '';
                    var idItem= el.split('/')[6];
                    if(el && !database[idItem] && idItem){
                        var x= await getdetailPromise({url: el});
                        if(x.data){
                            database[idItem]= true; save();
                            console.log('> download image');
                            x= await download(x.data, idItem, xPath);
                            if(x.err) throw x.err;
                        }
                    }
                }
            }
            if(dat.next) setTimeout(function(){
                scanImages({
                    url: dat.next
                })
            }, 3000)
        })();
    })
}

function getlistVideos(opt, cb){
    var id= ''+ opt.id;
    request.get({
        url: (opt.id) ? 'https://mbasic.facebook.com/'+ id+ '/videos' : opt.url,
        headers
    }, function(err, resp, body){
        if(resp && resp.statusCode!=200) require('fs').writeFileSync('./hack/test2.html', body)
        if(resp && resp.statusCode!=200) err= err|| {message: 'cookie expire'};
        if(err) return cb(err);

        if(body.startsWith('for (;;);')){
            body= body.replace('for (;;);', '');
            try{
                var a= JSON.parse(body);
                body= a["actions"][0].html || '';
                if(!body) throw new Error('body empty???');
            } catch(exbody){
                return cb(exbody);
            }
        }
        var $= cheerio.load(body);
        var data= {next: '', images: [], videos: []};
        $('td').each(function(i, el){
            var a= $(this).find('div a').eq(0).attr('href');
            if(a){
                if(a.includes('/video_redirect/')) data.videos.push(HOST_BASIC+ a);
            }
        })
        data.next= HOST_BASIC+ $('#m_pages_finch_see_more_videos a').eq(0).attr('href');
        cb(null, data);
    })
}

function scanVideos(opt, xPath){
    getlistVideos({id: opt.id, url: opt.url}, function(er, dat){
        if(er) return console.error(er);
        xPath= xPath || dat.next.split('/')[3];
        console.log({xPath});
        (async function(){
            if(dat.videos.length>0){
                for(var i in dat.videos){
                    var el= dat.videos[i];
                    if(el && !database[el.GetValue2('id')]){
                        var x= {data: el};
                        if(x.data){
                            database[el.GetValue2('id')]= true;
                            save();
                            console.log('> download videos');
                            x= await download2(x.data, el.GetValue2('id'), xPath);
                            if(x.err) throw x.err;
                        }
                    }
                }
            }
            if(dat.next) setTimeout(function(){
                scanVideos({
                    url: dat.next
                }, xPath)
            }, 3000)
        })();
    })
}

/*scanImages({
    id: 245983565864333
    //url: 'https://mbasic.facebook.com/dantocmongto/photos'
})*/

scanVideos({
    //url: 'https://mbasic.facebook.com/245983565864333/videos'
    url: 'https://mbasic.facebook.com/dantocmongto/videos'
})