package com.wavelength.music;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.IBinder;

/** Keeps the audio process important while providing Android lock-screen and notification controls. */
public final class MediaPlaybackService extends Service {
    public static final String ACTION_UPDATE="com.wavelength.music.UPDATE_PLAYBACK";
    public static final String ACTION_STOP="com.wavelength.music.STOP_PLAYBACK";
    public static final String ACTION_CONTROL="com.wavelength.music.MEDIA_CONTROL";
    private static final String CHANNEL="wavelength_playback";
    private static final int NOTIFICATION_ID=701;
    private MediaSession session;
    private String title="Wavelength",artist="",control="";
    private boolean playing;
    private long position,duration;

    @Override public void onCreate(){super.onCreate();createChannel();session=new MediaSession(this,"Wavelength");session.setCallback(new MediaSession.Callback(){@Override public void onPlay(){sendControl("play");}@Override public void onPause(){sendControl("pause");}@Override public void onSkipToNext(){sendControl("next");}@Override public void onSkipToPrevious(){sendControl("previous");}});session.setActive(true);}
    @Override public int onStartCommand(Intent intent,int flags,int startId){String action=intent==null?ACTION_UPDATE:intent.getAction();if(ACTION_STOP.equals(action)){stopForeground(true);if(session!=null){session.setActive(false);session.release();session=null;}stopSelf();return START_NOT_STICKY;}if(intent!=null){title=intent.getStringExtra("title")==null?title:intent.getStringExtra("title");artist=intent.getStringExtra("artist")==null?artist:intent.getStringExtra("artist");playing=intent.getBooleanExtra("playing",playing);position=intent.getLongExtra("position",position);duration=intent.getLongExtra("duration",duration);}updateSession();startForeground(NOTIFICATION_ID,buildNotification());return START_STICKY;}
    private void updateSession(){if(session==null)return;session.setMetadata(new MediaMetadata.Builder().putString(MediaMetadata.METADATA_KEY_TITLE,title).putString(MediaMetadata.METADATA_KEY_ARTIST,artist).putLong(MediaMetadata.METADATA_KEY_DURATION,duration).build());long actions=PlaybackState.ACTION_PLAY|PlaybackState.ACTION_PAUSE|PlaybackState.ACTION_PLAY_PAUSE|PlaybackState.ACTION_SKIP_TO_NEXT|PlaybackState.ACTION_SKIP_TO_PREVIOUS|PlaybackState.ACTION_SEEK_TO;session.setPlaybackState(new PlaybackState.Builder().setActions(actions).setState(playing?PlaybackState.STATE_PLAYING:PlaybackState.STATE_PAUSED,position,playing?1f:0f).build());}
    private Notification buildNotification(){PendingIntent open=controlIntent("open",0);Notification.Builder b=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,CHANNEL):new Notification.Builder(this);b.setSmallIcon(R.drawable.ic_notification_icon).setContentTitle(title).setContentText(artist).setContentIntent(open).setVisibility(Notification.VISIBILITY_PUBLIC).setOngoing(playing).setOnlyAlertOnce(true).addAction(new Notification.Action.Builder(android.R.drawable.ic_media_previous,"Previous",controlIntent("previous",1)).build()).addAction(new Notification.Action.Builder(playing?android.R.drawable.ic_media_pause:android.R.drawable.ic_media_play,playing?"Pause":"Play",controlIntent(playing?"pause":"play",2)).build()).addAction(new Notification.Action.Builder(android.R.drawable.ic_media_next,"Next",controlIntent("next",3)).build());b.setStyle(new Notification.MediaStyle().setMediaSession(session.getSessionToken()).setShowActionsInCompactView(0,1,2));return b.build();}
    private PendingIntent controlIntent(String value,int id){Intent intent=new Intent(this,LauncherActivity.class).setAction(ACTION_CONTROL).putExtra("control",value).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);return PendingIntent.getActivity(this,id,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
    private void sendControl(String action){Intent intent=new Intent(this,LauncherActivity.class).setAction(ACTION_CONTROL).putExtra("control",action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);startActivity(intent);}
    private void createChannel(){if(Build.VERSION.SDK_INT>=26){NotificationManager manager=getSystemService(NotificationManager.class);if(manager!=null)manager.createNotificationChannel(new NotificationChannel(CHANNEL,"Music playback",NotificationManager.IMPORTANCE_LOW));}}
    @Override public IBinder onBind(Intent intent){return null;}
}
