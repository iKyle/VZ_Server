// 在Cloud code里初始化express框架
var express = require('express');
var app = express();

// App全局配置
app.set('views','cloud/views');   //设置模板目录
app.set('view engine', 'ejs');    // 设置template引擎
app.use(express.bodyParser());    // 读取请求body的中间件

//================= Weibo ================
// var weibo = require('weibo');

var appkey = '795541860';
// var secret = '02f10f98f7c62bc49b60424035dcf5a1';
// var oauth_callback_url = 'http://127.0.0.1:8080/user/bind/weibo';
// weibo.init('weibo', appkey, secret, oauth_callback_url);


//var http= require('http');

var postQuery=new AV.Query('Post');
var Post = AV.Object.extend("Post");

function getPosts (userid,from,callback) {
    var path="/2/statuses/user_timeline.json?count=20&source="+appkey+"&uid="+userid+"&since_id="+from;
    var url="http://api.weibo.com"+path;
    console.log(url);

    var options = {
      url:url,
      method: 'GET'
    };
    AV.Cloud.httpRequest(options).then(function(res) {
            var json=res.data;
        
            var statuses=json['statuses'];
            
            var dels=[];
            var origs=[];
            for (var i = 0; i < statuses.length; i++) {
                var item=statuses[i];
                var orig=item['retweeted_status'];

                if (!orig) {continue;};

                var pid=orig['idstr'];
                var text=orig['text'];
                
                
                if (text.indexOf('此微博已被作者删除')>0) {
                    //TODO: 从数据库中标记为已交易 (Travis 13-10-13 16:44)
                    dels.push(pid);
                    continue;
                }
                    
                //TODO: 判断是否已经存在数据库中 (Travis 13-10-13 17:36)
                
                //删除@的多个微博账号
                var delReg=/@[^ $]+|我在:http:\/\/[a-zA-Z./0-9]+/g;
                text=text.replace(delReg,"");

                //删除连续空格
                text=text.replace(/\s\s/g, "");

                //0:出售 1:求购 2:删除
                var type=0; 
                if (text.indexOf('求购')>=0) {type=1};
               
                var post={
                    wbid:pid,
                    type:type,
                    text:text,
                    time:new Date(orig['created_at']),

                }
                
                //查找金额
                var priceReg=/(\d{1,})[出|元|包邮|不刀]|[币|￥|价格](\d{1,})/;
                parr = priceReg.exec(text); 
                if (parr) {
                    post.price=parr[parr.length-1];
                };

                //用户信息
                var ouser=orig['user'];
                post['user']={
                        id:ouser['idstr'],
                        name:ouser['name'],
                        //screen_name:ouser['screen_name'],
                        avatar:ouser['profile_image_url'],
                        verified:ouser['verified'],
                }

                //获取图片
                var pics=orig['pic_urls'];
                
                if (pics && pics.length>0) {
                    var tmp=[];
                    for (var j = 0; j < pics.length; j++) {
                        tmp.push(pics[j]['thumbnail_pic']);
                    };
                    post.pics=tmp;
                }

                //获取坐标
                if (orig['geo']) {
                    post.geo=orig['geo'];
                };
                origs.push(post);

                

            };
            
            if (dels.length>0) {
                var query = postQuery.containedIn('wbid',dels);
                query.destroyAll({
                    success:function(result){
                        console.log('delete result:',result);
                    }
                });
            };

            if (origs.length>0) {
                for (var i = 0; i < origs.length; i++) {
                    var postObj = new Post();
                    postObj.save(origs[i],{
                        success: function(p) {
                          console.log('succeed ',p.id);
                        },
                        error: function(p, error) {
                          
                          if (error.code!=137) {
                            console.error(error);
                          };
                        }
                    });
                };

                callback(null,origs);
            }else{
                callback(null,null);
            }
    });

    
}

exports.refresh=function(callback){
    var accs=['2043408047','1761596064','1882458640','1841288857','3787475667'];

    var index=Math.ceil(Math.random()*100)%accs.length;
    
    var acc=accs[index];
    getPosts(acc,0,callback);
}

//================= API ================

//获取最新微博 
app.get('/api/refresh/weibo',function (req,res) {

    exports.refresh(function (err,statuses) {
        if (err) {
            res.json(err);
        } else if(statuses){
            res.json(statuses);
        }else{
            res.send('nothing to do');
        }
    })
});



//使用express路由API服务/hello的http GET请求
app.get('/hello', function(req, res) {
  res.render('hello', { message: 'Congrats, you just set up your app!' });
});


app.get('/test', function(req, res) {

    res.send(Math.ceil(Math.random()*100)%5+'');
});

app.get('/test/:user/:action', function(req, res) {
  res.send("User:"+req.params.user+"<br/>Action:"+req.params.action);
});


//最后，必须有这行代码来使express响应http请求
app.listen();
