package com.wavelength.music;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.audiofx.BassBoost;
import android.media.audiofx.Equalizer;
import android.media.audiofx.LoudnessEnhancer;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.content.Context;
import android.os.CancellationSignal;
import android.widget.Button;
import android.widget.PopupMenu;
import android.widget.EditText;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialException;
import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import static com.google.android.libraries.identity.googleid.GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL;

/** Native Android Wavelength client. This activity intentionally does not use WebView or Chrome. */
public final class LauncherActivity extends Activity {
    // Keep the Android palette aligned with the browser app's Spotify-inspired theme.
    private static final int BG = Color.rgb(11, 11, 14);
    private static final int SIDE = Color.rgb(21, 21, 25);
    private static final int PANEL = Color.rgb(29, 29, 35);
    private static final int HOVER = Color.rgb(42, 42, 50);
    private static final int MUTED = Color.rgb(167, 167, 179);
    private static final int WHITE = Color.rgb(255, 255, 255);
    private static final int ACCENT = Color.rgb(30, 215, 96);
    private static final String PREFS = "wavelength_native";
    private static final String SAAVN = "https://saavn.bycomsolutions.com";
    private static final String AUDIUS = "https://api.audius.co/v1";

    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService requests = Executors.newFixedThreadPool(2);
    private final ArrayList<Track> favorites = new ArrayList<>();
    private final ArrayList<Track> history = new ArrayList<>();
    private final ArrayList<Track> localTracks = new ArrayList<>();
    private final ArrayList<Track> searchResults = new ArrayList<>();
    private final ArrayList<SavedEntity> artistResults = new ArrayList<>(), albumResults = new ArrayList<>(), followedArtists = new ArrayList<>(), savedAlbums = new ArrayList<>();
    private final ArrayList<HomeShelf> homeShelves = new ArrayList<>();
    private final ArrayList<UserPlaylist> playlists = new ArrayList<>();
    private final ArrayList<String> libraryRecent = new ArrayList<>();
    private String libraryQuery = "", librarySort = "recents";
    private final ArrayList<Track> playQueue = new ArrayList<>();
    private final Map<String, Bitmap> artworkCache = new HashMap<>();
    private LinearLayout root;
    private LinearLayout content;
    private LinearLayout playerPanel;
    private LinearLayout appHeader;
    private LinearLayout bottomNav;
    private TextView playerTitle;
    private TextView playerSubtitle;
    private TextView playPause;
    private SeekBar seekBar;
    private String activeTab = "Home";
    private String searchText = "";
    private Track currentTrack;
    private MediaPlayer mediaPlayer;
    private Equalizer equalizer;
    private BassBoost bassBoost;
    private LoudnessEnhancer loudnessEnhancer;
    private boolean lyricsOpen;
    private boolean lyricsLoading;
    private String lyricsText = "";
    private String lyricsRawSynced = "";
    private String lyricsTrackId = "";
    private final ArrayList<LyricLine> lyricLines = new ArrayList<>();
    private final ArrayList<TextView> lyricViews = new ArrayList<>();
    private ScrollView lyricsScroll;
    private SeekBar fullPlayerProgress;
    private int activeLyricLine=-1;
    private int bassDb;
    private int volumeDb;
    private int[] eqDb = {0, 0, 0, 0, 0};
    private String activePreset = "Flat";
    private String firebaseUid = "", firebaseIdToken = "", firebaseRefreshToken = "", accountEmail = "";
    private String profilePhotoData = "";
    private long firebaseTokenExpiresAt;
    private boolean guestSession, authBusy, createAccount;
    private boolean shuffleEnabled, spatialEnabled;
    private int repeatMode;
    private long spatialStartedAt;
    private EditText authEmail, authPassword;
    private boolean searchBusy;
    private CredentialManager credentialManager;
    private boolean googleSignInBusy;
    private boolean seekInProgress;
    private boolean homeLoading;
    private String entityDetailKey="";
    private SavedEntity openEntity;
    private ArrayList<Track> entityTracks=new ArrayList<>();
    private boolean entityLoading;
    private int resumePositionMs;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);
        getWindow().getDecorView().setSystemUiVisibility(0);
        loadSavedTracks();
        loadLocalTracks();
        firebaseIdToken = getPreferences().getString("firebase_id_token", "");
        firebaseRefreshToken = getPreferences().getString("firebase_refresh_token", "");
        firebaseUid = getPreferences().getString("firebase_uid", "");
        accountEmail = getPreferences().getString("firebase_email", "");
        profilePhotoData = getPreferences().getString("profile_photo", "");
        bassDb=getPreferences().getInt("fx_bass",0);volumeDb=getPreferences().getInt("fx_volume",0);activePreset=getPreferences().getString("fx_preset","Flat");spatialEnabled=getPreferences().getBoolean("fx_spatial",false);repeatMode=getPreferences().getInt("repeat_mode",0);shuffleEnabled=getPreferences().getBoolean("shuffle",false);for(int i=0;i<eqDb.length;i++)eqDb[i]=getPreferences().getInt("fx_eq_"+i,0);
        firebaseTokenExpiresAt = getPreferences().getLong("firebase_token_expires_at",0);
        guestSession = getPreferences().getBoolean("guest_session", false);
        buildShell();
        restoreResumeState();
        renderTab(firebaseUid.isEmpty() && !guestSession ? "Auth" : "Home");
        main.postDelayed(resumeSaveTicker,5000);
        if (!firebaseUid.isEmpty()) syncAccount();
        handleMediaControlIntent(getIntent());
        handleSharedPlaylistIntent(getIntent());
    }

    @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);if(handleMediaControlIntent(intent))return;handleSharedPlaylistIntent(intent);}
    private boolean handleMediaControlIntent(Intent intent){if(intent==null||!MediaPlaybackService.ACTION_CONTROL.equals(intent.getAction()))return false;handleMediaControl(intent.getStringExtra("control"));intent.setAction(null);intent.removeExtra("control");return true;}
    @Override protected void onPause(){saveResumeState();super.onPause();}

    private void buildShell() {
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(BG);
        root.setFitsSystemWindows(true);

        appHeader = new LinearLayout(this);
        LinearLayout header = appHeader;
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(dp(20), dp(12), dp(20), dp(10));
        TextView logo = text("W", 20, WHITE, true);
        logo.setGravity(Gravity.CENTER);
        logo.setBackground(round(Color.rgb(36, 36, 36), 24));
        logo.setOnClickListener(v -> renderTab("Account"));
        header.addView(logo, new LinearLayout.LayoutParams(dp(44), dp(44)));
        EditText topSearch = new EditText(this);
        topSearch.setSingleLine(true);
        topSearch.setTextColor(WHITE);
        topSearch.setHintTextColor(MUTED);
        topSearch.setHint("⌕   What do you want to play?");
        topSearch.setTextSize(14);
        topSearch.setPadding(dp(16), 0, dp(12), 0);
        topSearch.setBackground(round(PANEL, 28));
        topSearch.setFocusable(false);
        topSearch.setOnClickListener(v -> renderTab("Search"));
        header.addView(topSearch, marginParams(0, dp(46), 12, 0, 0, 0));
        header.getChildAt(1).setLayoutParams(new LinearLayout.LayoutParams(0, dp(46), 1));
        Button menu=button("⋯");menu.setTextSize(24);menu.setOnClickListener(v->{PopupMenu popup=new PopupMenu(this,menu);for(String page:new String[]{"Discover","Bollywood","Pakistani","Queue","Equalizer","Account"})popup.getMenu().add(page);popup.setOnMenuItemClickListener(item->{renderTab(item.getTitle().toString());return true;});popup.show();});header.addView(menu,new LinearLayout.LayoutParams(dp(48),dp(46)));
        root.addView(header);

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(false);
        content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(18), dp(8), dp(18), dp(20));
        scroll.addView(content);
        root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));

        playerPanel = new LinearLayout(this);
        playerPanel.setGravity(Gravity.CENTER_VERTICAL);
        playerPanel.setOrientation(LinearLayout.VERTICAL);
        playerPanel.setPadding(dp(16), dp(10), dp(16), dp(6));
        playerPanel.setBackgroundColor(PANEL);
        LinearLayout playerRow = new LinearLayout(this);
        playerRow.setGravity(Gravity.CENTER_VERTICAL);
        TextView cover = text("♫", 22, WHITE, true);
        cover.setGravity(Gravity.CENTER);
        cover.setBackground(round(ACCENT, 14));
        playerRow.addView(cover, new LinearLayout.LayoutParams(dp(44), dp(44)));
        LinearLayout labels = new LinearLayout(this);
        labels.setOrientation(LinearLayout.VERTICAL);
        labels.setPadding(dp(12), 0, dp(10), 0);
        playerTitle = text("Choose something to play", 14, WHITE, true);
        playerSubtitle = text("Wavelength", 12, MUTED, false);
        labels.addView(playerTitle);
        labels.addView(playerSubtitle);
        labels.setOnClickListener(v -> { if (currentTrack != null) renderTab("Player"); });
        playerRow.addView(labels, new LinearLayout.LayoutParams(0, -2, 1));
        playPause = text("▶", 22, WHITE, true);
        playPause.setGravity(Gravity.CENTER);
        playPause.setOnClickListener(v -> togglePlayback());
        playerRow.addView(playPause, new LinearLayout.LayoutParams(dp(48), dp(44)));
        playerPanel.addView(playerRow);
        seekBar = new SeekBar(this);
        seekBar.setMax(1000);
        seekBar.setPadding(0, 0, 0, 0);
        seekBar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override public void onProgressChanged(SeekBar bar, int progress, boolean fromUser) {
                if (fromUser && mediaPlayer != null && mediaPlayer.isPlaying()) {
                    int duration = safeDuration();
                    if (duration > 0) mediaPlayer.seekTo((int) (duration * (progress / 1000f)));
                }
            }
            @Override public void onStartTrackingTouch(SeekBar bar) { seekInProgress = true; }
            @Override public void onStopTrackingTouch(SeekBar bar) { seekInProgress = false; }
        });
        playerPanel.addView(seekBar, new LinearLayout.LayoutParams(-1, dp(22)));
        root.addView(playerPanel);

        bottomNav = new LinearLayout(this);
        LinearLayout nav = bottomNav;
        nav.setGravity(Gravity.CENTER);
        nav.setPadding(dp(4), dp(6), dp(4), dp(8));
        nav.setBackground(round(SIDE, 14));
        for (String tab : new String[]{"Home", "Search", "Library", "History"}) {
            String icon = "Home".equals(tab) ? "⌂" : "Search".equals(tab) ? "⌕" : "Library".equals(tab) ? "▤" : "◷";
            LinearLayout navItem = new LinearLayout(this);
            navItem.setOrientation(LinearLayout.VERTICAL);
            navItem.setGravity(Gravity.CENTER);
            TextView glyph = text(icon, 21, activeTab.equals(tab) ? WHITE : MUTED, true);
            glyph.setGravity(Gravity.CENTER);
            TextView label = text(tab, 10, activeTab.equals(tab) ? WHITE : MUTED, false);
            label.setGravity(Gravity.CENTER);
            navItem.addView(glyph);
            navItem.addView(label);
            View item = navItem;
            item.setOnClickListener(v -> renderTab(tab));
            nav.addView(item, new LinearLayout.LayoutParams(0, dp(50), 1));
        }
        root.addView(nav);
        setContentView(root);
        playerPanel.setVisibility(View.GONE);
        main.post(updateSeek);
    }

    private final Runnable updateSeek = new Runnable() {
        @Override public void run() {
            if (mediaPlayer != null && !seekInProgress) {
                int duration = safeDuration();
                int position = safePosition();
                if (duration > 0) seekBar.setProgress((int) (position * 1000f / duration));
                if(spatialEnabled){float pan=(float)Math.sin((System.currentTimeMillis()-spatialStartedAt)*0.000754f);try{mediaPlayer.setVolume(0.8f*(1f-pan)*0.5f,0.8f*(1f+pan)*0.5f);}catch(Exception ignored){}}
            }
            main.postDelayed(this, 700);
        }
    };

    private void renderTab(String tab) {
        activeTab = tab;
        if(!"Player".equals(tab)){fullPlayerProgress=null;lyricsScroll=null;lyricViews.clear();}
        content.setPadding(dp(18), dp(8), dp(18), dp(20));
        content.removeAllViews();
        if ("Home".equals(tab)) renderHome();
        else if ("Search".equals(tab)) renderSearch();
        else if ("Library".equals(tab)) renderLibrary();
        else if ("Local".equals(tab)) renderLocalLibrary();
        else if (tab.startsWith("Playlist:")) renderPlaylist(tab.substring(9));
        else if (tab.startsWith("Artist:")||tab.startsWith("Album:")) renderEntityDetail(tab);
        else if ("Player".equals(tab)) renderFullPlayer();
        else if ("Queue".equals(tab)) renderQueue();
        else if ("Auth".equals(tab)) renderAuth();
        else if ("Account".equals(tab)) renderAccount();
        else if ("Discover".equals(tab)||"Bollywood".equals(tab)||"Pakistani".equals(tab)) renderBrowse(tab);
        else if ("Equalizer".equals(tab)) renderEqualizerPage();
        else renderTrackCollection("Recently Played", history, "Songs you play will appear here.");
        boolean fullPlayer = "Player".equals(tab), auth = "Auth".equals(tab);
        appHeader.setVisibility(fullPlayer || auth ? View.GONE : View.VISIBLE);
        bottomNav.setVisibility(fullPlayer || auth ? View.GONE : View.VISIBLE);
        playerPanel.setVisibility(!fullPlayer && currentTrack != null ? View.VISIBLE : View.GONE);
    }

    private void renderAuth() {
        content.setGravity(Gravity.CENTER_HORIZONTAL);
        content.setPadding(dp(24), dp(45), dp(24), dp(24));
        addHeading("Wavelength", "Sign in to sync your library across devices.");
        authEmail = new EditText(this); authEmail.setSingleLine(true); authEmail.setTextColor(WHITE); authEmail.setHintTextColor(MUTED); authEmail.setHint("Email address"); authEmail.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS); authEmail.setBackground(round(PANEL,12));
        authPassword = new EditText(this); authPassword.setSingleLine(true); authPassword.setTextColor(WHITE); authPassword.setHintTextColor(MUTED); authPassword.setHint("Password (6+ characters)"); authPassword.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD); authPassword.setBackground(round(PANEL,12));
        content.addView(authEmail,marginParams(-1,dp(54),0,dp(24),0,10)); content.addView(authPassword,marginParams(-1,dp(54),0,0,0,14));
        Button primary=button(createAccount?"Create account":"Log in"); primary.setOnClickListener(v->authenticate()); content.addView(primary,marginParams(-1,dp(50),0,0,0,8));
        Button googleButton=button("Continue with Google");googleButton.setOnClickListener(v->signInWithGoogle());content.addView(googleButton,marginParams(-1,dp(50),0,0,0,8));
        Button toggle=button(createAccount?"I already have an account":"Create account");toggle.setOnClickListener(v->{createAccount=!createAccount;renderTab("Auth");});content.addView(toggle,marginParams(-1,dp(48),0,0,0,8));
        Button guest=button("Continue without an account");guest.setOnClickListener(v->{guestSession=true;getPreferences().edit().putBoolean("guest_session",true).apply();renderTab("Home");});content.addView(guest,marginParams(-1,dp(48),0,dp(16),0,8));
        addNote("Guest mode keeps your library on this device. Sign in to sync it with the Wavelength website.");
        content.setGravity(Gravity.NO_GRAVITY);
    }

    private void renderAccount(){addHeading("Account",firebaseUid.isEmpty()?"Guest session · this device only":accountEmail);Button photo=button(profilePhotoData.isEmpty()?"Choose profile photo":"Change profile photo");photo.setOnClickListener(v->{Intent pick=new Intent(Intent.ACTION_GET_CONTENT);pick.setType("image/*");startActivityForResult(Intent.createChooser(pick,"Choose profile photo"),43);});content.addView(photo,marginParams(-1,dp(46),0,0,0,8));if(!profilePhotoData.isEmpty()){Button remove=button("Remove profile photo");remove.setOnClickListener(v->{profilePhotoData="";getPreferences().edit().remove("profile_photo").apply();scheduleCloudSave();renderTab("Account");});content.addView(remove,marginParams(-1,dp(42),0,0,0,12));}if(firebaseUid.isEmpty()){Button login=button("Log in or create account");login.setOnClickListener(v->{guestSession=false;getPreferences().edit().putBoolean("guest_session",false).apply();renderTab("Auth");});content.addView(login,marginParams(-1,dp(50),0,0,0,10));}else{Button sync=button("Sync library now");sync.setOnClickListener(v->{syncAccount();Toast.makeText(this,"Library sync started.",Toast.LENGTH_SHORT).show();});content.addView(sync,marginParams(-1,dp(50),0,0,0,10));Button signOut=button("Log out");signOut.setOnClickListener(v->{getPreferences().edit().remove("firebase_id_token").remove("firebase_refresh_token").remove("firebase_uid").remove("firebase_email").remove("firebase_token_expires_at").putBoolean("guest_session",true).apply();firebaseUid="";firebaseIdToken="";firebaseRefreshToken="";firebaseTokenExpiresAt=0;accountEmail="";guestSession=true;renderTab("Home");});content.addView(signOut,marginParams(-1,dp(50),0,0,0,10));}addNote("Tap the W icon in the top left to return here.");}
    private void renderBrowse(String section){addHeading(section,"Browse and search across the same music sources.");String[] terms="Bollywood".equals(section)?new String[]{"Arijit Singh","Shreya Ghoshal","90s Bollywood","Romantic Hindi","Atif Aslam"}:"Pakistani".equals(section)?new String[]{"Coke Studio Pakistan","Atif Aslam","Rahat Fateh Ali Khan","Young Stunners","Pashto music","Sindhi music","Saraiki music"}:new String[]{"Lo-fi","Electronic","Ambient","Pop","Rock","Jazz","Hip-hop","Classical"};for(String term:terms){Button choice=button(term);choice.setOnClickListener(v->{runSearch(term);});content.addView(choice,marginParams(-1,dp(44),0,0,0,6));}Button search=button("Search all music");search.setOnClickListener(v->renderTab("Search"));content.addView(search,marginParams(-1,dp(48),0,dp(12),0,0));}
    private void renderEqualizerPage(){addHeading("Equalizer","Bass booster, 5-band equalizer and 8D audio.");addSoundControls();addSectionTitle("5-band equalizer");String[] labels={"60 Hz","230 Hz","910 Hz","3.6 kHz","14 kHz"};for(int i=0;i<labels.length;i++){final int band=i;addEffectSlider(labels[i],-12,12,eqDb[i],value->{eqDb[band]=value;activePreset="Custom";applyEqualizer();saveAudioSettings();});}Button spatial=button(spatialEnabled?"8D audio · On":"8D audio · Off");spatial.setOnClickListener(v->{spatialEnabled=!spatialEnabled;spatialStartedAt=System.currentTimeMillis();saveAudioSettings();renderTab("Equalizer");});content.addView(spatial,marginParams(-1,dp(46),0,10,0,0));}

    private void authenticate() {
        String email=authEmail.getText().toString().trim(), password=authPassword.getText().toString();
        if(email.isEmpty()||password.isEmpty()){Toast.makeText(this,"Enter your email and password.",Toast.LENGTH_SHORT).show();return;}
        authBusy=true; String operation=createAccount?"signUp":"signInWithPassword";
        requests.execute(()->{try{JSONObject payload=new JSONObject();payload.put("email",email);payload.put("password",password);payload.put("returnSecureToken",true);JSONObject result=postJson("https://identitytoolkit.googleapis.com/v1/accounts:"+operation+"?key="+BuildConfig.FIREBASE_API_KEY,payload,null);rememberAuth(result,email);main.post(()->{authBusy=false;renderTab("Home");syncAccount();});}catch(Exception error){main.post(()->{authBusy=false;Toast.makeText(this,authError(error.getMessage()),Toast.LENGTH_LONG).show();});}});
    }

    private void signInWithGoogle(){
        if(googleSignInBusy)return;
        googleSignInBusy=true;
        try{
            if(credentialManager==null)credentialManager=CredentialManager.create(this);
            GetGoogleIdOption googleOption=new GetGoogleIdOption.Builder().setServerClientId(BuildConfig.GOOGLE_WEB_CLIENT_ID).setFilterByAuthorizedAccounts(false).setAutoSelectEnabled(false).build();
            GetCredentialRequest request=new GetCredentialRequest.Builder().addCredentialOption(googleOption).build();
            credentialManager.getCredentialAsync(this,request,new CancellationSignal(),requests,new CredentialManagerCallback<GetCredentialResponse,GetCredentialException>(){
                @Override public void onResult(GetCredentialResponse response){try{Credential credential=response.getCredential();if(!(credential instanceof CustomCredential)||!TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType()))throw new IllegalStateException("Google sign-in did not return an ID token.");GoogleIdTokenCredential token=GoogleIdTokenCredential.createFrom(((CustomCredential)credential).getData());finishGoogleSignIn(token.getIdToken());}catch(RuntimeException error){main.post(()->{googleSignInBusy=false;Toast.makeText(LauncherActivity.this,"Google sign-in could not be completed.",Toast.LENGTH_LONG).show();});}}
                @Override public void onError(GetCredentialException error){main.post(()->{googleSignInBusy=false;Toast.makeText(LauncherActivity.this,"Google sign-in cancelled or unavailable. Try again.",Toast.LENGTH_LONG).show();});}
            });
        }catch(Exception error){googleSignInBusy=false;Toast.makeText(this,"Google sign-in is unavailable on this device.",Toast.LENGTH_LONG).show();}
    }

    private void rememberAuth(JSONObject result,String email){firebaseIdToken=result.optString("idToken");firebaseRefreshToken=result.optString("refreshToken");firebaseUid=result.optString("localId");accountEmail=result.optString("email",email);firebaseTokenExpiresAt=System.currentTimeMillis()+Math.max(60,result.optLong("expiresIn",3600)-60)*1000L;guestSession=false;getPreferences().edit().putString("firebase_id_token",firebaseIdToken).putString("firebase_refresh_token",firebaseRefreshToken).putString("firebase_uid",firebaseUid).putString("firebase_email",accountEmail).putLong("firebase_token_expires_at",firebaseTokenExpiresAt).putBoolean("guest_session",false).apply();}
    private void finishGoogleSignIn(String googleIdToken){requests.execute(()->{try{JSONObject payload=new JSONObject();payload.put("postBody","id_token="+URLEncoder.encode(googleIdToken,"UTF-8")+"&providerId=google.com");payload.put("requestUri","http://localhost");payload.put("returnSecureToken",true);JSONObject result=postJson("https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key="+BuildConfig.FIREBASE_API_KEY,payload,null);rememberAuth(result,"");main.post(()->{googleSignInBusy=false;renderTab("Home");syncAccount();});}catch(Exception error){main.post(()->{googleSignInBusy=false;Toast.makeText(this,authError(error.getMessage()),Toast.LENGTH_LONG).show();});}});}

    private String authError(String value){if(value==null)return "Sign-in failed.";if(value.contains("EMAIL_EXISTS"))return "That email already has an account.";if(value.contains("INVALID_PASSWORD")||value.contains("INVALID_LOGIN_CREDENTIALS"))return "Email or password is incorrect.";if(value.contains("EMAIL_NOT_FOUND"))return "No account exists for that email.";if(value.contains("WEAK_PASSWORD"))return "Password must be at least 6 characters.";if(value.contains("INVALID_IDP_RESPONSE")||value.contains("INVALID_ID_TOKEN"))return "Google sign-in could not be verified. Check that this app is registered in Firebase.";return "Could not sign in. Check your connection and try again.";}

    private void syncAccount(){if(firebaseUid.isEmpty()||firebaseIdToken.isEmpty())return;requests.execute(()->{try{JSONObject cloud=firestoreGet(firebaseUid);if(cloud!=null){profilePhotoData=cloud.optString("profilePhoto",profilePhotoData);getPreferences().edit().putString("profile_photo",profilePhotoData).apply();if(cloud.has("savedAlbums"))loadEntities(cloud.optJSONArray("savedAlbums"),savedAlbums,false);if(cloud.has("followedArtists"))loadEntities(cloud.optJSONArray("followedArtists"),followedArtists,true);saveEntities();JSONArray cloudRecent=cloud.optJSONArray("rp");if(cloudRecent!=null){libraryRecent.clear();for(int i=0;i<cloudRecent.length();i++)libraryRecent.add(cloudRecent.optString(i));}JSONArray cloudLiked=cloud.optJSONArray("liked");if(cloudLiked!=null){ArrayList<Track> loaded=new ArrayList<>();for(int i=0;i<cloudLiked.length();i++){String id=cloudLiked.optString(i);Track from=findTrack(cloud,id);loaded.add(from!=null?from:new Track(id,"Unknown title","Unknown artist","","",sourceFor(id)));}favorites.clear();favorites.addAll(loaded);}JSONArray cloudHistory=cloud.optJSONArray("hist");if(cloudHistory!=null){ArrayList<Track> loaded=new ArrayList<>();for(int i=0;i<cloudHistory.length();i++){JSONObject item=cloudHistory.optJSONObject(i);if(item!=null){Track from=trackFrom(item);if(from!=null)loaded.add(from);}}history.clear();history.addAll(loaded);}JSONArray cloudPlaylists=cloud.optJSONArray("playlists");if(cloudPlaylists!=null){ArrayList<UserPlaylist> loaded=new ArrayList<>();for(int i=0;i<cloudPlaylists.length();i++){JSONObject item=cloudPlaylists.optJSONObject(i);if(item!=null){UserPlaylist p=new UserPlaylist(item.optString("id"),item.optString("name","Playlist"));p.description=item.optString("description");p.cover=item.optString("cover");p.publicPlaylist=item.optBoolean("isPublic");p.shareId=item.optString("shareId");p.createdAt=item.optLong("createdAt",p.createdAt);p.updatedAt=item.optLong("updatedAt",p.updatedAt);JSONArray td=item.optJSONArray("trackData");if(td!=null)for(int j=0;j<td.length();j++){Track t=trackFrom(td.optJSONObject(j));if(t!=null)p.tracks.add(t);}loaded.add(p);}}playlists.clear();playlists.addAll(loaded);}saveTracks();savePlaylists();}firestoreSave(firebaseUid,mergeAccountData(cloud,accountData()));}catch(Exception ignored){}});}
    private JSONObject mergeAccountData(JSONObject cloud,JSONObject nativeData)throws Exception{JSONObject merged=cloud==null?new JSONObject():new JSONObject(cloud.toString());java.util.Iterator<String> keys=nativeData.keys();while(keys.hasNext()){String key=keys.next();merged.put(key,nativeData.get(key));}return merged;}
    private Track trackFrom(JSONObject item){String id=item.optString("id");if(id.isEmpty())return null;String url=item.optString("url",item.optString("stream"));String img=item.optString("img",item.optString("image"));return new Track(id,item.optString("title","Unknown title"),item.optString("artist","Unknown artist"),url,img,sourceFor(id));}
    private Track findTrack(JSONObject data,String id){JSONArray sources=data.optJSONArray("jam");if(sources!=null)for(int i=0;i<sources.length();i++){JSONObject j=sources.optJSONObject(i);if(j!=null&&id.equals(j.optString("id")))return trackFrom(j);}sources=data.optJSONArray("hist");if(sources!=null)for(int i=0;i<sources.length();i++){JSONObject j=sources.optJSONObject(i);if(j!=null&&id.equals(j.optString("id")))return trackFrom(j);}sources=data.optJSONArray("playlists");if(sources!=null)for(int i=0;i<sources.length();i++){JSONObject p=sources.optJSONObject(i);JSONArray td=p==null?null:p.optJSONArray("trackData");if(td!=null)for(int j=0;j<td.length();j++){JSONObject t=td.optJSONObject(j);if(t!=null&&id.equals(t.optString("id")))return trackFrom(t);}}for(Track t:history)if(t.id.equals(id))return t;for(Track t:favorites)if(t.id.equals(id))return t;return null;}
    private String sourceFor(String id){return id.startsWith("s")?"JioSaavn":id.startsWith("a")?"Audius":id.startsWith("g")?"Gaana":id.startsWith("j")?"Jamendo":"Music";}
    private String providerKey(String id){return id.startsWith("s")?"saavn":id.startsWith("a")?"audius":id.startsWith("g")?"gaana":id.startsWith("j")?"jamendo":"local";}
    private JSONObject accountData()throws Exception{JSONObject data=new JSONObject();JSONArray liked=new JSONArray();for(Track t:favorites)liked.put(t.id);JSONArray jam=new JSONArray();for(Track t:favorites){if(!t.id.startsWith("local:")){JSONObject x=trackJson(t);x.put("dur",0);jam.put(x);}}JSONArray hist=new JSONArray();long stamp=System.currentTimeMillis();for(Track t:history){JSONObject x=trackJson(t);x.put("ts",stamp--);hist.put(x);}JSONArray playlistArray=new JSONArray();for(UserPlaylist p:playlists){JSONObject x=new JSONObject();x.put("id",p.id);x.put("name",p.name);x.put("description",p.description);x.put("cover",p.cover);x.put("isPublic",p.publicPlaylist);x.put("shareId",p.shareId);x.put("createdAt",p.createdAt);x.put("updatedAt",p.updatedAt);JSONArray ids=new JSONArray(),tracks=new JSONArray();for(Track t:p.tracks){ids.put(t.id);JSONObject tx=trackJson(t);tx.put("g",providerKey(t.id));tx.put("dur",0);tx.put("hue",0);tracks.put(tx);}x.put("tracks",ids);x.put("trackData",tracks);playlistArray.put(x);}data.put("liked",liked);data.put("jam",jam);data.put("hist",hist);data.put("playlists",playlistArray);data.put("savedAlbums",entityArray(savedAlbums));data.put("followedArtists",entityArray(followedArtists));data.put("profilePhoto",profilePhotoData);JSONArray recent=new JSONArray();for(String id:libraryRecent)recent.put(id);data.put("rp",recent);return data;}
    private JSONObject trackJson(Track t)throws Exception{JSONObject x=new JSONObject();x.put("id",t.id);x.put("title",t.title);x.put("artist",t.artist);x.put("url",t.streamUrl);x.put("img",t.imageUrl);return x;}

    private void refreshFirebaseTokenIfNeeded()throws Exception{if(firebaseTokenExpiresAt>System.currentTimeMillis()+90000)return;if(firebaseRefreshToken.isEmpty())throw new java.io.IOException("Your sign-in expired. Please log in again.");String form="grant_type=refresh_token&refresh_token="+encode(firebaseRefreshToken);HttpURLConnection c=(HttpURLConnection)new URL("https://securetoken.googleapis.com/v1/token?key="+BuildConfig.FIREBASE_API_KEY).openConnection();c.setRequestMethod("POST");c.setDoOutput(true);c.setConnectTimeout(10000);c.setReadTimeout(12000);c.setRequestProperty("Content-Type","application/x-www-form-urlencoded");c.getOutputStream().write(form.getBytes(StandardCharsets.UTF_8));int status=c.getResponseCode();InputStream in=status>=200&&status<300?c.getInputStream():c.getErrorStream();ByteArrayOutputStream out=new ByteArrayOutputStream();if(in!=null){byte[] bytes=new byte[2048];int n;while((n=in.read(bytes))!=-1)out.write(bytes,0,n);in.close();}c.disconnect();if(status<200||status>=300)throw new java.io.IOException("Your sign-in expired. Please log in again.");JSONObject response=new JSONObject(out.toString("UTF-8"));firebaseIdToken=response.optString("id_token");firebaseRefreshToken=response.optString("refresh_token",firebaseRefreshToken);firebaseUid=response.optString("user_id",firebaseUid);firebaseTokenExpiresAt=System.currentTimeMillis()+Math.max(60,response.optLong("expires_in",3600)-60)*1000L;getPreferences().edit().putString("firebase_id_token",firebaseIdToken).putString("firebase_refresh_token",firebaseRefreshToken).putString("firebase_uid",firebaseUid).putLong("firebase_token_expires_at",firebaseTokenExpiresAt).apply();}
    private JSONObject firestoreGet(String uid)throws Exception{refreshFirebaseTokenIfNeeded();String address="https://firestore.googleapis.com/v1/projects/"+BuildConfig.FIREBASE_PROJECT_ID+"/databases/(default)/documents/users/"+encode(uid);HttpURLConnection c=(HttpURLConnection)new URL(address).openConnection();c.setRequestProperty("Authorization","Bearer "+firebaseIdToken);c.setConnectTimeout(10000);c.setReadTimeout(12000);int status=c.getResponseCode();if(status==404){c.disconnect();return null;}InputStream in=status>=200&&status<300?c.getInputStream():c.getErrorStream();if(in==null)throw new java.io.IOException("Firestore unavailable");ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1)out.write(b,0,n);c.disconnect();JSONObject response=new JSONObject(out.toString("UTF-8"));JSONObject fields=response.optJSONObject("fields"), decoded=new JSONObject();if(fields!=null){java.util.Iterator<String> keys=fields.keys();while(keys.hasNext()){String key=keys.next();decoded.put(key,decodeFirestore(fields.optJSONObject(key)));}}return decoded;}
    private void firestoreSave(String uid,JSONObject data)throws Exception{JSONObject fields=new JSONObject();java.util.Iterator<String> keys=data.keys();while(keys.hasNext()){String key=keys.next();fields.put(key,encodeFirestore(data.get(key)));}JSONObject body=new JSONObject();body.put("fields",fields);String address="https://firestore.googleapis.com/v1/projects/"+BuildConfig.FIREBASE_PROJECT_ID+"/databases/(default)/documents/users/"+encode(uid);HttpURLConnection c=(HttpURLConnection)new URL(address).openConnection();c.setRequestMethod("PATCH");c.setDoOutput(true);c.setConnectTimeout(10000);c.setReadTimeout(12000);c.setRequestProperty("Content-Type","application/json");c.setRequestProperty("Authorization","Bearer "+firebaseIdToken);c.getOutputStream().write(body.toString().getBytes(StandardCharsets.UTF_8));int status=c.getResponseCode();if(status<200||status>=300){InputStream error=c.getErrorStream();ByteArrayOutputStream out=new ByteArrayOutputStream();if(error!=null){byte[] b=new byte[2048];int n;while((n=error.read(b))!=-1)out.write(b,0,n);}c.disconnect();throw new java.io.IOException(out.toString("UTF-8"));}c.disconnect();}
    private void firestoreWriteDocument(String collection,String id,JSONObject data)throws Exception{refreshFirebaseTokenIfNeeded();JSONObject fields=new JSONObject();java.util.Iterator<String> keys=data.keys();while(keys.hasNext()){String key=keys.next();fields.put(key,encodeFirestore(data.get(key)));}JSONObject body=new JSONObject();body.put("fields",fields);String address="https://firestore.googleapis.com/v1/projects/"+BuildConfig.FIREBASE_PROJECT_ID+"/databases/(default)/documents/"+collection+"/"+encode(id);HttpURLConnection c=(HttpURLConnection)new URL(address).openConnection();c.setRequestMethod("PATCH");c.setDoOutput(true);c.setConnectTimeout(10000);c.setReadTimeout(12000);c.setRequestProperty("Content-Type","application/json");c.setRequestProperty("Authorization","Bearer "+firebaseIdToken);c.getOutputStream().write(body.toString().getBytes(StandardCharsets.UTF_8));int status=c.getResponseCode();if(status<200||status>=300){InputStream in=c.getErrorStream();ByteArrayOutputStream out=new ByteArrayOutputStream();if(in!=null){byte[] bytes=new byte[2048];int n;while((n=in.read(bytes))!=-1)out.write(bytes,0,n);}c.disconnect();throw new java.io.IOException(out.toString("UTF-8"));}c.disconnect();}
    private void firestoreDeleteDocument(String collection,String id)throws Exception{refreshFirebaseTokenIfNeeded();String address="https://firestore.googleapis.com/v1/projects/"+BuildConfig.FIREBASE_PROJECT_ID+"/databases/(default)/documents/"+collection+"/"+encode(id);HttpURLConnection c=(HttpURLConnection)new URL(address).openConnection();c.setRequestMethod("DELETE");c.setConnectTimeout(10000);c.setReadTimeout(12000);c.setRequestProperty("Authorization","Bearer "+firebaseIdToken);int status=c.getResponseCode();c.disconnect();if(status<200||status>=300)throw new java.io.IOException("Could not update shared playlist.");}
    private JSONObject encodeFirestore(Object value)throws Exception{JSONObject out=new JSONObject();if(value==JSONObject.NULL)out.put("nullValue",JSONObject.NULL);else if(value instanceof JSONObject){JSONObject map=new JSONObject();java.util.Iterator<String> keys=((JSONObject)value).keys();while(keys.hasNext()){String k=keys.next();map.put(k,encodeFirestore(((JSONObject)value).get(k)));}out.put("mapValue",new JSONObject().put("fields",map));}else if(value instanceof JSONArray){JSONArray values=new JSONArray();for(int i=0;i<((JSONArray)value).length();i++)values.put(encodeFirestore(((JSONArray)value).get(i)));out.put("arrayValue",new JSONObject().put("values",values));}else if(value instanceof Boolean)out.put("booleanValue",value);else if(value instanceof Number)out.put(value instanceof Float||value instanceof Double?"doubleValue":"integerValue",String.valueOf(value));else out.put("stringValue",String.valueOf(value));return out;}
    private Object decodeFirestore(JSONObject value)throws Exception{if(value==null)return JSONObject.NULL;if(value.has("stringValue"))return value.getString("stringValue");if(value.has("booleanValue"))return value.getBoolean("booleanValue");if(value.has("integerValue"))return Long.parseLong(value.getString("integerValue"));if(value.has("doubleValue"))return value.getDouble("doubleValue");if(value.has("nullValue"))return JSONObject.NULL;if(value.has("arrayValue")){JSONArray raw=value.getJSONObject("arrayValue").optJSONArray("values"),out=new JSONArray();if(raw!=null)for(int i=0;i<raw.length();i++)out.put(decodeFirestore(raw.optJSONObject(i)));return out;}if(value.has("mapValue")){JSONObject fields=value.getJSONObject("mapValue").optJSONObject("fields"),out=new JSONObject();if(fields!=null){java.util.Iterator<String> keys=fields.keys();while(keys.hasNext()){String key=keys.next();out.put(key,decodeFirestore(fields.optJSONObject(key)));}}return out;}return JSONObject.NULL;}
    private JSONObject postJson(String address,JSONObject body,String bearer)throws Exception{HttpURLConnection c=(HttpURLConnection)new URL(address).openConnection();c.setRequestMethod("POST");c.setDoOutput(true);c.setConnectTimeout(10000);c.setReadTimeout(12000);c.setRequestProperty("Content-Type","application/json");if(bearer!=null)c.setRequestProperty("Authorization","Bearer "+bearer);c.getOutputStream().write(body.toString().getBytes(StandardCharsets.UTF_8));int status=c.getResponseCode();InputStream in=status>=200&&status<300?c.getInputStream():c.getErrorStream();ByteArrayOutputStream out=new ByteArrayOutputStream();if(in!=null){byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1)out.write(b,0,n);in.close();}c.disconnect();if(status<200||status>=300)throw new java.io.IOException(out.toString("UTF-8"));return new JSONObject(out.toString("UTF-8"));}

    private void renderHome() {
        addHeading("Good afternoon", "");
        LinearLayout shortcuts = new LinearLayout(this);
        shortcuts.setOrientation(LinearLayout.HORIZONTAL);
        shortcuts.addView(shortcutCard("Liked Songs", favorites.size() + " songs", ACCENT, () -> renderTab("Library")), new LinearLayout.LayoutParams(0, dp(70), 1));
        shortcuts.addView(shortcutCard("Recently Played", history.size() + " songs", HOVER, () -> renderTab("History")), marginParams(0, dp(70), 8, 0, 0, 0));
        shortcuts.getChildAt(1).setLayoutParams(new LinearLayout.LayoutParams(0, dp(70), 1));
        content.addView(shortcuts, marginParams(-1, dp(70), 0, 0, 0, 18));

        if (homeLoading && homeShelves.isEmpty()) addNote("Loading music for you…");
        if (!homeShelves.isEmpty()) {
            for (HomeShelf shelf : homeShelves) addHomeShelf(shelf.title, shelf.tracks);
        } else if (!homeLoading) {
            Button discover = button("Search music");
            discover.setOnClickListener(v -> renderTab("Search"));
            content.addView(discover, marginParams(-1, dp(48), 0, 8, 0, 0));
        }
        addSectionTitle("Your music");
        Button addMusic = button("＋  Add music from device");
        addMusic.setOnClickListener(v -> pickLocalAudio());
        content.addView(addMusic, marginParams(-1, dp(48), 0, 6, 0, 0));
        if (!homeLoading && homeShelves.isEmpty()) loadHomeShelves();
    }

    private View shortcutCard(String title, String subtitle, int tint, Runnable action) {
        LinearLayout card = new LinearLayout(this);
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setPadding(dp(12), dp(8), dp(8), dp(8));
        card.setBackground(round(PANEL, 8));
        TextView artwork = text("♫", 20, WHITE, true);
        artwork.setGravity(Gravity.CENTER);
        artwork.setBackground(round(tint, 8));
        card.addView(artwork, new LinearLayout.LayoutParams(dp(52), dp(52)));
        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        copy.setPadding(dp(10), 0, 0, 0);
        copy.addView(text(title, 13, WHITE, true));
        copy.addView(text(subtitle, 11, MUTED, false));
        card.addView(copy);
        card.setOnClickListener(v -> action.run());
        return card;
    }

    private void addHomeShelf(String title, ArrayList<Track> tracks) {
        if (tracks == null || tracks.isEmpty()) return;
        addSectionTitle(title);
        HorizontalScrollView horizontal = new HorizontalScrollView(this);
        horizontal.setHorizontalScrollBarEnabled(false);
        LinearLayout cards = new LinearLayout(this);
        cards.setOrientation(LinearLayout.HORIZONTAL);
        for (Track track : tracks) {
            LinearLayout card = new LinearLayout(this);
            card.setOrientation(LinearLayout.VERTICAL);
            card.setPadding(dp(10), dp(10), dp(10), dp(10));
            card.setBackground(round(PANEL, 10));
            ImageView art = new ImageView(this);
            art.setScaleType(ImageView.ScaleType.CENTER_CROP);
            art.setBackground(round(colorFor(track.id), 8));
            art.setImageDrawable(round(colorFor(track.id), 8));
            card.addView(art, new LinearLayout.LayoutParams(dp(132), dp(132)));
            loadArtwork(track.imageUrl, art);
            TextView name = text(track.title, 13, WHITE, true);
            name.setMaxLines(1);
            name.setEllipsize(android.text.TextUtils.TruncateAt.END);
            card.addView(name, marginParams(dp(132), -2, 0, 8, 0, 2));
            TextView artist = text(track.artist, 11, MUTED, false);
            artist.setMaxLines(2);
            artist.setEllipsize(android.text.TextUtils.TruncateAt.END);
            card.addView(artist, new LinearLayout.LayoutParams(dp(132), dp(32)));
            card.setOnClickListener(v -> { playFromQueue(tracks,track); renderTab("Player"); });
            cards.addView(card, marginParams(-2, -2, 0, 0, 10, 0));
        }
        horizontal.addView(cards);
        content.addView(horizontal, marginParams(-1, -2, -10, 0, -10, 22));
    }

    private void loadHomeShelves() {
        homeLoading = true;
        // Fetch the same public discovery shelves as the website without sending local listening data.
        String[] queries = {"Arijit Singh songs", "Pakistani songs", "Coke Studio Pakistan", "Bollywood hits", "Trending songs"};
        requests.execute(() -> {
            ArrayList<HomeShelf> loaded = new ArrayList<>();
            String[] titles = {"Picked for you", "Pakistani Music", "Coke Studio Pakistan", "Popular Bollywood", "Trending songs"};
            for (int i = 0; i < queries.length; i++) {
                ArrayList<Track> tracks = new ArrayList<>();
                try { tracks.addAll(searchSaavn(queries[i])); } catch (Exception ignored) { }
                try { tracks.addAll(searchAudius(queries[i])); } catch (Exception ignored) { }
                try { tracks.addAll(searchGaana(queries[i])); } catch (Exception ignored) { }
                try { tracks.addAll(searchJamendo(queries[i])); } catch (Exception ignored) { }
                if (i == 0) tracks.removeIf(track -> !track.artist.toLowerCase().contains("arijit"));
                if (!tracks.isEmpty()) loaded.add(new HomeShelf(titles[i], uniqueTracks(tracks)));
            }
            main.post(() -> {
                homeLoading = false;
                homeShelves.clear();
                ArrayList<Track> mix = new ArrayList<>();
                mix.addAll(favorites);
                mix.addAll(history);
                mix = uniqueTracks(mix);
                homeShelves.addAll(loaded);
                if (!mix.isEmpty()) homeShelves.add(Math.min(1, homeShelves.size()), new HomeShelf("Daily Mix", mix));
                if ("Home".equals(activeTab)) renderTab("Home");
            });
        });
    }

    private ArrayList<Track> uniqueTracks(ArrayList<Track> tracks) {
        ArrayList<Track> unique = new ArrayList<>();
        java.util.HashSet<String> ids = new java.util.HashSet<>();
        for (Track track : tracks) if (ids.add(track.id)) unique.add(track);
        return unique;
    }

    private void loadArtwork(String address, ImageView target) {
        if (address == null || address.isEmpty()) return;
        Bitmap cached = artworkCache.get(address);
        if (cached != null) { target.setImageBitmap(cached); return; }
        requests.execute(() -> {
            try (InputStream input = new URL(address).openStream()) {
                Bitmap bitmap = BitmapFactory.decodeStream(input);
                if (bitmap != null) {
                    synchronized (artworkCache) { artworkCache.put(address, bitmap); }
                    main.post(() -> target.setImageBitmap(bitmap));
                }
            } catch (Exception ignored) { }
        });
    }

    private void renderSearch() {
        addHeading("Search", "Discover tracks from Wavelength music sources.");
        LinearLayout inputRow = new LinearLayout(this);
        inputRow.setGravity(Gravity.CENTER_VERTICAL);
        EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setTextColor(WHITE);
        input.setHintTextColor(MUTED);
        input.setHint("Songs, artists, moods…");
        input.setText(searchText);
        input.setInputType(InputType.TYPE_CLASS_TEXT);
        input.setImeOptions(EditorInfo.IME_ACTION_SEARCH);
        input.setPadding(dp(14), 0, dp(14), 0);
        input.setBackground(round(PANEL, 14));
        inputRow.addView(input, new LinearLayout.LayoutParams(0, dp(52), 1));
        Button submit = button("Go");
        inputRow.addView(submit, marginParams(dp(68), dp(52), 8, 0, 0, 0));
        content.addView(inputRow, marginParams(-1, dp(52), 0, 0, 0, 18));
        submit.setOnClickListener(v -> submitSearch(input));
        input.setOnEditorActionListener((v, action, event) -> {
            if (action == EditorInfo.IME_ACTION_SEARCH) { submitSearch(input); return true; }
            return false;
        });
        if (searchBusy) addNote("Searching Wavelength music sources…");
        else if (!searchText.isEmpty() && searchResults.isEmpty()) addNote("No tracks yet. Search for a song or artist.");
        for (Track track : searchResults) addTrackRow(track);
        if(!artistResults.isEmpty()){addSectionTitle("Artists");for(SavedEntity e:artistResults)addSearchEntity(e);}
        if(!albumResults.isEmpty()){addSectionTitle("Albums");for(SavedEntity e:albumResults)addSearchEntity(e);}
    }

    private void submitSearch(EditText input) {
        searchText = input.getText().toString().trim();
        ((InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(input.getWindowToken(), 0);
        if (!searchText.isEmpty()) runSearch(searchText);
    }

    private void runSearch(String query) {
        searchText = query;
        searchBusy = true;
        searchResults.clear();
        artistResults.clear();albumResults.clear();
        renderTab("Search");
        requests.execute(() -> {
            ArrayList<Track> found = new ArrayList<>();
            String error = null;
            try { found.addAll(searchSaavn(query)); } catch (Exception e) { error = e.getMessage(); }
            try { found.addAll(searchAudius(query)); } catch (Exception e) { if (error == null) error = e.getMessage(); }
            try { found.addAll(searchGaana(query)); } catch (Exception e) { if (error == null) error = e.getMessage(); }
            try { found.addAll(searchJamendo(query)); } catch (Exception e) { if (error == null) error = e.getMessage(); }
            ArrayList<SavedEntity> foundArtists=new ArrayList<>(),foundAlbums=new ArrayList<>();
            try{foundArtists.addAll(searchEntities(query,true));}catch(Exception ignored){}
            try{foundAlbums.addAll(searchEntities(query,false));}catch(Exception ignored){}
            final String message = found.isEmpty() ? (error == null ? "No tracks found. Try another search." : "Could not load results. Check your connection and try again.") : null;
            main.post(() -> {
                searchBusy = false;
                searchResults.clear();
                searchResults.addAll(found);
                artistResults.clear();artistResults.addAll(foundArtists);albumResults.clear();albumResults.addAll(foundAlbums);
                renderTab("Search");
                if (message != null) Toast.makeText(this, message, Toast.LENGTH_LONG).show();
            });
        });
    }

    private ArrayList<Track> searchSaavn(String query) throws Exception {
        JSONObject root = getJson(SAAVN + "/api/search/songs?query=" + encode(query) + "&page=0&limit=20");
        JSONArray list = findArray(root, "results", "songs", "data");
        ArrayList<Track> out = new ArrayList<>();
        for (int i = 0; i < list.length(); i++) {
            JSONObject item = list.optJSONObject(i);
            if (item == null) continue;
            String stream = bestUrl(item.optJSONArray("downloadUrl"));
            if (stream.isEmpty()) continue;
            out.add(new Track("s" + item.optString("id"), item.optString("name", item.optString("title", "Unknown title")), artists(item), stream, imageUrl(item.optJSONArray("image")), "JioSaavn"));
        }
        return out;
    }

    private ArrayList<SavedEntity> searchEntities(String query,boolean artist)throws Exception{JSONObject response=getJson(SAAVN+"/api/search/"+(artist?"artists":"albums")+"?query="+encode(query)+"&page=0&limit=16");JSONArray list=findArray(response,"results","data","albums","artists");ArrayList<SavedEntity> out=new ArrayList<>();for(int i=0;i<list.length();i++){JSONObject item=list.optJSONObject(i);if(item==null)continue;String id=item.optString("id"),name=item.optString("name",item.optString("title",""));if(id.isEmpty()||name.isEmpty())continue;SavedEntity entity=new SavedEntity(id,name,item.optString("artist",item.optString("description",artist?"Artist":"Album")),imageUrl(item.optJSONArray("image")),artist,item.optString("url"));entity.saved=isEntitySaved(entity);out.add(entity);}return out;}
    private boolean isEntitySaved(SavedEntity entity){ArrayList<SavedEntity> list=entity.artist?followedArtists:savedAlbums;for(SavedEntity item:list)if(item.id.equals(entity.id))return true;return false;}
    private void addSearchEntity(SavedEntity entity){LinearLayout row=new LinearLayout(this);row.setGravity(Gravity.CENTER_VERTICAL);row.setPadding(dp(10),dp(7),dp(8),dp(7));row.setBackground(round(PANEL,12));TextView name=text((entity.artist?"♪  ":"♫  ")+entity.name+" · "+entity.artistName,14,WHITE,true);name.setMaxLines(1);name.setEllipsize(android.text.TextUtils.TruncateAt.END);row.addView(name,new LinearLayout.LayoutParams(0,-2,1));Button save=button(entity.saved?"Saved":"＋ Save");save.setOnClickListener(v->{toggleEntity(entity);save.setText(entity.saved?"Saved":"＋ Save");});row.addView(save);row.setOnClickListener(v->openEntity(entity));content.addView(row,marginParams(-1,dp(56),0,0,0,6));}
    private void toggleEntity(SavedEntity entity){ArrayList<SavedEntity> target=entity.artist?followedArtists:savedAlbums;SavedEntity found=null;for(SavedEntity item:target)if(item.id.equals(entity.id)){found=item;break;}if(found!=null)target.remove(found);else target.add(0,entity);entity.saved=found==null;saveEntities();scheduleCloudSave();}
    private void saveEntities(){try{getPreferences().edit().putString("saved_albums",entityArray(savedAlbums).toString()).putString("followed_artists",entityArray(followedArtists).toString()).apply();}catch(Exception ignored){}}
    private void loadEntities(String json,ArrayList<SavedEntity> target,boolean artist){try{JSONArray values=new JSONArray(json);for(int i=0;i<values.length();i++){JSONObject x=values.optJSONObject(i);if(x!=null)target.add(new SavedEntity(x.optString("id"),x.optString("name"),x.optString("artist"),x.optString("img"),artist,x.optString("url")));}}catch(Exception ignored){}}
    private void loadEntities(JSONArray values,ArrayList<SavedEntity> target,boolean artist){if(values==null)return;ArrayList<SavedEntity> loaded=new ArrayList<>();for(int i=0;i<values.length();i++){JSONObject x=values.optJSONObject(i);if(x!=null)loaded.add(new SavedEntity(x.optString("id"),x.optString("name"),x.optString("artist"),x.optString("img"),artist,x.optString("url")));}target.clear();target.addAll(loaded);}
    private JSONArray entityArray(ArrayList<SavedEntity> list)throws Exception{JSONArray out=new JSONArray();for(SavedEntity e:list){JSONObject x=new JSONObject();x.put("id",e.id);x.put("name",e.name);x.put("artist",e.artistName);x.put("img",e.image);x.put("url",e.url);out.put(x);}return out;}
    private void openEntity(SavedEntity entity){openEntity=entity;entityDetailKey=(entity.artist?"Artist:":"Album:")+entity.id;entityLoading=true;entityTracks.clear();renderTab(entityDetailKey);requests.execute(()->{ArrayList<Track> songs=new ArrayList<>();try{String path=entity.artist?"/api/artists/"+encode(entity.id)+"/songs?page=0&sort=1":"/api/albums?id="+encode(entity.id);JSONObject response=getJson(SAAVN+path);JSONArray list=findArray(response,"songs","tracks","results","data");if(list.length()==0&&!entity.artist){JSONObject album=response.optJSONObject("album");if(album!=null)list=findArray(album,"songs","tracks");}for(int i=0;i<list.length();i++){JSONObject item=list.optJSONObject(i);if(item!=null){String stream=bestUrl(item.optJSONArray("downloadUrl"));if(!stream.isEmpty())songs.add(new Track("s"+item.optString("id"),item.optString("name",item.optString("title")),artists(item),stream,imageUrl(item.optJSONArray("image")),"JioSaavn"));}}}catch(Exception ignored){}final ArrayList<Track> loaded=songs;main.post(()->{entityLoading=false;entityTracks=loaded;if(activeTab.equals(entityDetailKey))renderTab(activeTab);});});}
    private void renderEntityDetail(String key){if(openEntity==null){addHeading("Music","Select an artist or album.");return;}addHeading(openEntity.name,openEntity.artist?"Artist · JioSaavn":openEntity.artistName+" · Album");Button save=button(openEntity.saved?(openEntity.artist?"Following ✓":"Saved ✓"):(openEntity.artist?"＋ Follow artist":"＋ Save album"));save.setOnClickListener(v->{toggleEntity(openEntity);renderTab(key);});content.addView(save,marginParams(-1,dp(46),0,0,0,12));if(entityLoading)addNote("Loading songs…");else if(entityTracks.isEmpty())addNote("No playable songs available from this album or artist.");for(Track track:entityTracks)addTrackRow(track);}

    private ArrayList<Track> searchAudius(String query) throws Exception {
        JSONObject root = getJson(AUDIUS + "/tracks/search?query=" + encode(query) + "&limit=20&app_name=Wavelength");
        JSONArray list = root.optJSONArray("data");
        ArrayList<Track> out = new ArrayList<>();
        if (list == null) return out;
        for (int i = 0; i < list.length(); i++) {
            JSONObject item = list.optJSONObject(i);
            if (item == null || item.optBoolean("is_streamable", true) == false) continue;
            JSONObject user = item.optJSONObject("user");
            JSONObject artwork = item.optJSONObject("artwork");
            String id = item.optString("id");
            String stream = AUDIUS + "/tracks/" + encode(id) + "/stream?app_name=Wavelength";
            out.add(new Track("a" + id, item.optString("title", "Unknown title"), user == null ? "Unknown artist" : user.optString("name", "Unknown artist"), stream, artwork == null ? "" : artwork.optString("480x480", artwork.optString("150x150", "")), "Audius"));
        }
        return out;
    }

    private ArrayList<Track> searchGaana(String query)throws Exception{
        JSONObject root=getJson("https://shnwazdev-gaana-api.vercel.app/api/search?q="+encode(query)+"&type=song&limit=30");JSONArray list=findArray(root,"results","data","songs");ArrayList<Track> out=new ArrayList<>();for(int i=0;i<list.length();i++){JSONObject item=list.optJSONObject(i);if(item==null)continue;String title=item.optString("title",item.optString("name",""));String artist=item.optString("artist",item.optString("artist_name",item.optString("singer","Unknown artist")));String stream=item.optString("link",item.optString("stream_url",item.optString("audio_url",item.optString("audio",""))));String art=item.optString("thumb",item.optString("image",item.optString("artwork","")));String id=item.optString("id",item.optString("seokey",title));if(title.isEmpty()||stream.isEmpty())continue;out.add(new Track("g"+id,title,artist,stream,art,"Gaana"));}return out;
    }

    private ArrayList<Track> searchJamendo(String query)throws Exception{
        if(BuildConfig.JAMENDO_CLIENT_ID.isEmpty())return new ArrayList<>();JSONObject root=getJson("https://api.jamendo.com/v3.0/tracks/?client_id="+encode(BuildConfig.JAMENDO_CLIENT_ID)+"&format=json&limit=30&search="+encode(query)+"&audioformat=mp31");JSONArray list=root.optJSONArray("results");ArrayList<Track> out=new ArrayList<>();if(list==null)return out;for(int i=0;i<list.length();i++){JSONObject item=list.optJSONObject(i);if(item==null)continue;String stream=item.optString("audio",item.optString("audiodownload"));if(stream.isEmpty())continue;out.add(new Track("j"+item.optString("id"),item.optString("name"),item.optString("artist_name","Unknown artist"),stream,item.optString("image"),"Jamendo"));}return out;
    }

    private JSONObject getJson(String address) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(address).openConnection();
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(18000);
        connection.setRequestProperty("Accept", "application/json");
        try (InputStream input = connection.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            return new JSONObject(new String(output.toByteArray(), StandardCharsets.UTF_8));
        } finally { connection.disconnect(); }
    }

    private static JSONArray findArray(JSONObject object, String... keys) {
        if (object == null) return new JSONArray();
        for (String key : keys) {
            Object value = object.opt(key);
            if (value instanceof JSONArray) return (JSONArray) value;
            if (value instanceof JSONObject) {
                JSONObject nested = (JSONObject) value;
                for (String inner : new String[]{"results", "songs", "data", "artists", "albums", "tracks"}) {
                    if (nested.opt(inner) instanceof JSONArray) return nested.optJSONArray(inner);
                }
            }
        }
        return new JSONArray();
    }

    private static String bestUrl(JSONArray values) {
        if (values == null) return "";
        String best = ""; int quality = -1;
        for (int i = 0; i < values.length(); i++) {
            JSONObject item = values.optJSONObject(i);
            if (item == null) continue;
            int q = item.optInt("quality", 0);
            String url = item.optString("url", "");
            if (!url.isEmpty() && q >= quality) { quality = q; best = url; }
        }
        return best;
    }

    private static String imageUrl(JSONArray values) {
        if (values == null) return "";
        String best = ""; int quality = -1;
        for (int i = 0; i < values.length(); i++) {
            JSONObject item = values.optJSONObject(i);
            if (item == null) continue;
            int q = item.optInt("quality", 0);
            String url = item.optString("url", "");
            if (!url.isEmpty() && q >= quality) { quality = q; best = url; }
        }
        return best;
    }

    private static String artists(JSONObject item) {
        JSONObject artistData = item.optJSONObject("artists");
        JSONArray values = artistData == null ? null : artistData.optJSONArray("primary");
        if (values == null && artistData != null) values = artistData.optJSONArray("all");
        if (values == null) return "Unknown artist";
        ArrayList<String> names = new ArrayList<>();
        for (int i = 0; i < values.length(); i++) {
            JSONObject a = values.optJSONObject(i);
            if (a != null && !a.optString("name").isEmpty()) names.add(a.optString("name"));
        }
        return names.isEmpty() ? "Unknown artist" : android.text.TextUtils.join(", ", names);
    }

    private void renderTrackCollection(String title, ArrayList<Track> tracks, String emptyText) {
        addHeading(title, "Saved on this device.");
        if (tracks.isEmpty()) addNote(emptyText);
        for (Track track : new ArrayList<>(tracks)) addTrackRow(track);
    }

    private void renderLibrary(){
        addHeading("Your Library","Your music, your collections.");
        LinearLayout tools=new LinearLayout(this);tools.setOrientation(LinearLayout.HORIZONTAL);
        Button search=button(libraryQuery.isEmpty()?"⌕  Search in Your Library":"⌕  "+libraryQuery);search.setOnClickListener(v->{EditText input=new EditText(this);input.setSingleLine(true);input.setHint("Search playlists and saved music");input.setText(libraryQuery);new AlertDialog.Builder(this).setTitle("Search in Your Library").setView(input).setNegativeButton("Clear",(d,w)->{libraryQuery="";renderTab("Library");}).setNeutralButton("Cancel",null).setPositiveButton("Search",(d,w)->{libraryQuery=input.getText().toString().trim();renderTab("Library");}).show();});
        Button sort=button(("alpha".equals(librarySort)?"Alphabetical":"added".equals(librarySort)?"Recently Added":"Recents")+"  ☰");sort.setOnClickListener(v->{PopupMenu menu=new PopupMenu(this,sort);menu.getMenu().add("Recents").setOnMenuItemClickListener(i->setLibrarySort("recents"));menu.getMenu().add("Recently Added").setOnMenuItemClickListener(i->setLibrarySort("added"));menu.getMenu().add("Alphabetical").setOnMenuItemClickListener(i->setLibrarySort("alpha"));menu.show();});tools.addView(search,new LinearLayout.LayoutParams(0,dp(46),1));tools.addView(sort,new LinearLayout.LayoutParams(-2,dp(46)));content.addView(tools,marginParams(-1,dp(46),0,0,0,10));
        Button create=button("＋ Create playlist");create.setOnClickListener(v->createPlaylist());content.addView(create,marginParams(-1,dp(48),0,0,0,16));addSectionTitle("Playlists & collections");
        if(matchesLibrary("Liked Songs",favorites))addLibraryEntry("Liked Songs",favorites.size()+" songs",()->{touchLibrary("liked");renderTrackCollection("Liked Songs",favorites,"Songs you like will appear here.");});
        ArrayList<UserPlaylist> ordered=new ArrayList<>(playlists);if("alpha".equals(librarySort))Collections.sort(ordered,(a,b)->a.name.compareToIgnoreCase(b.name));else if("added".equals(librarySort))Collections.sort(ordered,(a,b)->Long.compare(b.createdAt,a.createdAt));else Collections.sort(ordered,(a,b)->Integer.compare(recentIndex(a.id),recentIndex(b.id)));
        for(UserPlaylist playlist:ordered)if(matchesLibrary(playlist.name,playlist.tracks))addLibraryEntry(playlist.name,playlist.tracks.size()+" songs",()->{touchLibrary(playlist.id);renderTab("Playlist:"+playlist.id);});
        if(!localTracks.isEmpty()&&matchesLibrary("Your music",localTracks))addLibraryEntry("Your music",localTracks.size()+" songs on this device",()->{touchLibrary("local");renderTab("Local");});if(matchesLibrary("Recently Played",history))addLibraryEntry("Recently Played",history.size()+" songs",()->{touchLibrary("history");renderTab("History");});
        addSectionTitle("Saved albums");boolean albumShown=false;for(SavedEntity e:new ArrayList<>(savedAlbums))if(entityMatches(e)){albumShown=true;addLibraryEntry(e.name,e.artistName,()->{touchLibrary("album:"+e.id);openEntity(e);});}if(savedAlbums.isEmpty()||(!libraryQuery.isEmpty()&&!albumShown))addNote("Albums you save will appear here.");
        addSectionTitle("Followed artists");boolean artistShown=false;for(SavedEntity e:new ArrayList<>(followedArtists))if(entityMatches(e)){artistShown=true;addLibraryEntry(e.name,e.artistName,()->{touchLibrary("artist:"+e.id);openEntity(e);});}if(followedArtists.isEmpty()||(!libraryQuery.isEmpty()&&!artistShown))addNote("Artists you follow will appear here.");
    }
    private boolean entityMatches(SavedEntity e){String q=libraryQuery.toLowerCase(java.util.Locale.ROOT);return e.name.toLowerCase(java.util.Locale.ROOT).contains(q)||e.artistName.toLowerCase(java.util.Locale.ROOT).contains(q);}
    private boolean matchesLibrary(String title,ArrayList<Track> tracks){String q=libraryQuery.toLowerCase(java.util.Locale.ROOT);if(q.isEmpty()||title.toLowerCase(java.util.Locale.ROOT).contains(q))return true;for(Track t:tracks)if(t.title.toLowerCase(java.util.Locale.ROOT).contains(q)||t.artist.toLowerCase(java.util.Locale.ROOT).contains(q))return true;return false;}
    private int recentIndex(String id){int index=libraryRecent.indexOf(id);return index<0?999:index;}
    private void touchLibrary(String id){libraryRecent.remove(id);libraryRecent.add(0,id);while(libraryRecent.size()>20)libraryRecent.remove(libraryRecent.size()-1);getPreferences().edit().putString("library_recent",new JSONArray(libraryRecent).toString()).apply();scheduleCloudSave();}
    private boolean setLibrarySort(String sort){librarySort=sort;getPreferences().edit().putString("library_sort",sort).apply();renderTab("Library");return true;}

    private void renderLocalLibrary(){addHeading("Your music",localTracks.size()+" songs stored from this device");Button add=button("＋ Add music from device");add.setOnClickListener(v->pickLocalAudio());content.addView(add,marginParams(-1,dp(46),0,0,0,8));if(!localTracks.isEmpty()){Button clear=button("Remove all songs");clear.setOnClickListener(v->new AlertDialog.Builder(this).setMessage("Remove all songs imported from this device?").setNegativeButton("Cancel",null).setPositiveButton("Remove all",(d,w)->{for(Track t:new ArrayList<>(localTracks))try{getContentResolver().releasePersistableUriPermission(Uri.parse(t.streamUrl),Intent.FLAG_GRANT_READ_URI_PERMISSION);}catch(Exception ignored){}localTracks.clear();getPreferences().edit().remove("local_tracks").apply();if(currentTrack!=null&&currentTrack.id.startsWith("local:")){releasePlayer();currentTrack=null;}renderTab("Local");}).show());content.addView(clear,marginParams(-1,dp(44),0,0,0,12));}if(localTracks.isEmpty())addNote("Music you add from this device will appear here.");for(Track t:new ArrayList<>(localTracks))addTrackRow(t);}
    private void addLibraryEntry(String title,String subtitle,Runnable open){Button item=button("♫   "+title+"     ·     "+subtitle);item.setGravity(Gravity.CENTER_VERTICAL|Gravity.START);item.setOnClickListener(v->open.run());content.addView(item,marginParams(-1,dp(56),0,0,0,8));}
    private void createPlaylist(){EditText name=new EditText(this);name.setSingleLine(true);name.setHint("Playlist name");new AlertDialog.Builder(this).setTitle("Create playlist").setView(name).setNegativeButton("Cancel",(d,w)->{}).setPositiveButton("Create",(d,w)->{String value=name.getText().toString().trim();if(value.isEmpty())return;UserPlaylist p=new UserPlaylist("p_"+System.currentTimeMillis(),value);playlists.add(0,p);savePlaylists();scheduleCloudSave();renderTab("Library");}).show();}
    private void renderPlaylist(String id){UserPlaylist found=null;for(UserPlaylist item:playlists)if(item.id.equals(id)){found=item;break;}if(found==null){renderTab("Library");return;}final UserPlaylist playlist=found;addHeading(playlist.name,playlist.tracks.size()+" songs"+(playlist.publicPlaylist?" · Public":" · Private")+(playlist.description.isEmpty()?"":"\n"+playlist.description));LinearLayout actions=new LinearLayout(this);Button play=button("▶ Play");play.setOnClickListener(v->{if(!playlist.tracks.isEmpty())playFromQueue(playlist.tracks,playlist.tracks.get(0));renderTab("Player");});Button shuffle=button("⇄ Shuffle");shuffle.setOnClickListener(v->{if(!playlist.tracks.isEmpty()){shuffleEnabled=true;ArrayList<Track> shuffled=new ArrayList<>(playlist.tracks);Collections.shuffle(shuffled);playFromQueue(shuffled,shuffled.get(0));renderTab("Player");}});Button add=button("＋ Add current song");add.setOnClickListener(v->{if(currentTrack==null){Toast.makeText(this,"Play a song first.",Toast.LENGTH_SHORT).show();return;}playlist.tracks.add(currentTrack);playlist.updatedAt=System.currentTimeMillis();savePlaylists();scheduleCloudSave();if(playlist.publicPlaylist)publishPlaylist(playlist);renderTab("Playlist:"+id);});actions.addView(play,new LinearLayout.LayoutParams(0,dp(46),1));actions.addView(shuffle,new LinearLayout.LayoutParams(0,dp(46),1));actions.addView(add,new LinearLayout.LayoutParams(0,dp(46),1));content.addView(actions,marginParams(-1,dp(46),0,0,0,8));Button edit=button("Edit playlist details");edit.setOnClickListener(v->editPlaylistDetails(playlist));content.addView(edit,marginParams(-1,dp(42),0,0,0,7));Button share=button(playlist.publicPlaylist?"Share public playlist link":"Make playlist public");share.setOnClickListener(v->{if(playlist.publicPlaylist)sharePlaylistLink(playlist);else makePlaylistPublic(playlist);});content.addView(share,marginParams(-1,dp(42),0,0,0,7));Button visibility=button(playlist.publicPlaylist?"Make private":"Delete playlist");visibility.setOnClickListener(v->{if(playlist.publicPlaylist)new AlertDialog.Builder(this).setMessage("Make this playlist private? Its share link will stop working.").setNegativeButton("Cancel",null).setPositiveButton("Make private",(d,w)->makePlaylistPrivate(playlist)).show();else new AlertDialog.Builder(this).setMessage("Delete this playlist?").setNegativeButton("Cancel",null).setPositiveButton("Delete",(d,w)->{playlists.remove(playlist);savePlaylists();scheduleCloudSave();renderTab("Library");}).show();});content.addView(visibility,marginParams(-1,dp(42),0,0,0,14));for(int i=0;i<playlist.tracks.size();i++){final int index=i;LinearLayout track=addTrackRow(playlist.tracks.get(i));content.removeView(track);LinearLayout wrapper=new LinearLayout(this);wrapper.setGravity(Gravity.CENTER_VERTICAL);wrapper.addView(track,new LinearLayout.LayoutParams(0,-2,1));LinearLayout controls=new LinearLayout(this);controls.setOrientation(LinearLayout.VERTICAL);TextView up=text("↑",17,WHITE,true);up.setGravity(Gravity.CENTER);up.setOnClickListener(v->movePlaylistTrack(playlist,index,-1));TextView down=text("↓",17,WHITE,true);down.setGravity(Gravity.CENTER);down.setOnClickListener(v->movePlaylistTrack(playlist,index,1));TextView remove=text("×",19,MUTED,true);remove.setGravity(Gravity.CENTER);remove.setOnClickListener(v->removePlaylistTrack(playlist,index));controls.addView(up,new LinearLayout.LayoutParams(dp(32),dp(30)));controls.addView(down,new LinearLayout.LayoutParams(dp(32),dp(30)));controls.addView(remove,new LinearLayout.LayoutParams(dp(32),dp(30)));wrapper.addView(controls);content.addView(wrapper,marginParams(-1,-2,0,0,0,7));}}
    private void editPlaylistDetails(UserPlaylist playlist){LinearLayout form=new LinearLayout(this);form.setOrientation(LinearLayout.VERTICAL);EditText name=new EditText(this);name.setSingleLine(true);name.setHint("Playlist name");name.setText(playlist.name);EditText description=new EditText(this);description.setHint("Description");description.setText(playlist.description);EditText cover=new EditText(this);cover.setSingleLine(true);cover.setHint("Cover image URL (optional)");cover.setText(playlist.cover);form.addView(name);form.addView(description);form.addView(cover);new AlertDialog.Builder(this).setTitle("Edit playlist details").setView(form).setNegativeButton("Cancel",null).setPositiveButton("Save",(d,w)->{String value=name.getText().toString().trim();if(!value.isEmpty())playlist.name=value;playlist.description=description.getText().toString().trim();playlist.cover=cover.getText().toString().trim();playlist.updatedAt=System.currentTimeMillis();savePlaylists();scheduleCloudSave();if(playlist.publicPlaylist)publishPlaylist(playlist);renderTab("Playlist:"+playlist.id);}).show();}
    private void movePlaylistTrack(UserPlaylist playlist,int index,int delta){int to=index+delta;if(to<0||to>=playlist.tracks.size())return;Collections.swap(playlist.tracks,index,to);playlist.updatedAt=System.currentTimeMillis();savePlaylists();scheduleCloudSave();if(playlist.publicPlaylist)publishPlaylist(playlist);renderTab("Playlist:"+playlist.id);}
    private void removePlaylistTrack(UserPlaylist playlist,int index){if(index<0||index>=playlist.tracks.size())return;playlist.tracks.remove(index);playlist.updatedAt=System.currentTimeMillis();savePlaylists();scheduleCloudSave();if(playlist.publicPlaylist)publishPlaylist(playlist);renderTab("Playlist:"+playlist.id);}

    private void makePlaylistPublic(UserPlaylist playlist){if(firebaseUid.isEmpty()){Toast.makeText(this,"Log in to publish a playlist.",Toast.LENGTH_LONG).show();renderTab("Auth");return;}if(playlist.tracks.size()>500){Toast.makeText(this,"A shared playlist can contain up to 500 songs.",Toast.LENGTH_LONG).show();return;}if(playlist.shareId.isEmpty())playlist.shareId=java.util.UUID.randomUUID().toString().replace("-","").substring(0,20);playlist.publicPlaylist=true;playlist.updatedAt=System.currentTimeMillis();requests.execute(()->{try{firestoreWriteDocument("sharedPlaylists",playlist.shareId,sharedPlaylistData(playlist));main.post(()->{savePlaylists();scheduleCloudSave();sharePlaylistLink(playlist);renderTab("Playlist:"+playlist.id);});}catch(Exception error){playlist.publicPlaylist=false;main.post(()->Toast.makeText(this,"Could not publish playlist. Check your connection and Firebase access.",Toast.LENGTH_LONG).show());}});}
    private JSONObject sharedPlaylistData(UserPlaylist playlist)throws Exception{JSONObject data=new JSONObject();data.put("ownerId",firebaseUid);data.put("isPublic",true);data.put("name",playlist.name.substring(0,Math.min(70,playlist.name.length())));data.put("description",playlist.description.substring(0,Math.min(240,playlist.description.length())));data.put("cover",playlist.cover.substring(0,Math.min(600,playlist.cover.length())));JSONArray tracks=new JSONArray();int localCount=0;for(Track track:playlist.tracks){if(track.id.startsWith("local:")){localCount++;continue;}JSONObject item=new JSONObject();item.put("id",track.id);item.put("title",track.title.substring(0,Math.min(160,track.title.length())));item.put("artist",track.artist.substring(0,Math.min(160,track.artist.length())));item.put("album","");item.put("img",track.imageUrl.substring(0,Math.min(600,track.imageUrl.length())));item.put("g",providerKey(track.id));item.put("dur",0);tracks.put(item);}data.put("localTrackCount",localCount);data.put("tracks",tracks);data.put("updatedAt",playlist.updatedAt);return data;}
    private void makePlaylistPrivate(UserPlaylist playlist){String shareId=playlist.shareId;playlist.publicPlaylist=false;playlist.shareId="";playlist.updatedAt=System.currentTimeMillis();requests.execute(()->{try{if(!shareId.isEmpty())firestoreDeleteDocument("sharedPlaylists",shareId);}catch(Exception ignored){}main.post(()->{savePlaylists();scheduleCloudSave();renderTab("Playlist:"+playlist.id);});});}
    private void publishPlaylist(UserPlaylist playlist){if(!playlist.publicPlaylist||playlist.shareId.isEmpty())return;requests.execute(()->{try{firestoreWriteDocument("sharedPlaylists",playlist.shareId,sharedPlaylistData(playlist));}catch(Exception ignored){}});}
    private void sharePlaylistLink(UserPlaylist playlist){if(playlist.shareId.isEmpty())return;String link="https://wavelength-d6a7c.web.app/?sharedPlaylist="+Uri.encode(playlist.shareId);Intent send=new Intent(Intent.ACTION_SEND);send.setType("text/plain");send.putExtra(Intent.EXTRA_TEXT,link);startActivity(Intent.createChooser(send,"Share playlist"));}

    private void handleSharedPlaylistIntent(Intent intent){if(intent==null||intent.getData()==null)return;String shareId=intent.getData().getQueryParameter("sharedPlaylist");if(shareId==null||shareId.trim().isEmpty())return;loadSharedPlaylist(shareId.trim());}
    private JSONObject firestoreGetSharedPlaylist(String shareId)throws Exception{String address="https://firestore.googleapis.com/v1/projects/"+BuildConfig.FIREBASE_PROJECT_ID+"/databases/(default)/documents/sharedPlaylists/"+encode(shareId);HttpURLConnection c=(HttpURLConnection)new URL(address).openConnection();c.setConnectTimeout(10000);c.setReadTimeout(12000);int status=c.getResponseCode();if(status==404){c.disconnect();return null;}InputStream in=status>=200&&status<300?c.getInputStream():c.getErrorStream();if(in==null)throw new java.io.IOException("Shared playlist unavailable");ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buffer=new byte[4096];int count;while((count=in.read(buffer))!=-1)out.write(buffer,0,count);c.disconnect();JSONObject fields=new JSONObject(out.toString("UTF-8")).optJSONObject("fields"),data=new JSONObject();if(fields!=null){java.util.Iterator<String> keys=fields.keys();while(keys.hasNext()){String key=keys.next();data.put(key,decodeFirestore(fields.optJSONObject(key)));}}return data;}
    private void loadSharedPlaylist(String shareId){requests.execute(()->{try{JSONObject data=firestoreGetSharedPlaylist(shareId);if(data==null||!data.optBoolean("isPublic"))throw new java.io.IOException("This shared playlist is unavailable.");JSONArray items=data.optJSONArray("tracks");ArrayList<Track> tracks=new ArrayList<>();if(items!=null)for(int i=0;i<items.length();i++){JSONObject item=items.optJSONObject(i);if(item==null)continue;String id=item.optString("id"),title=item.optString("title","Unknown title"),artist=item.optString("artist","Unknown artist"),image=item.optString("img");if(id.isEmpty())continue;Track shared=new Track(id,title,artist,"",image,sourceFor(id));tracks.add(resolveSharedTrack(shared));}String name=data.optString("name","Shared playlist");String description=data.optString("description","");main.post(()->new AlertDialog.Builder(this).setTitle(name).setMessage(description+(description.isEmpty()?"":"\n\n")+tracks.size()+" songs · shared playlist").setNegativeButton("Not now",null).setPositiveButton("Add to library",(dialog,which)->{UserPlaylist imported=new UserPlaylist("p_"+System.currentTimeMillis(),name);imported.description=description;imported.cover=data.optString("cover","");imported.tracks.addAll(tracks);playlists.add(0,imported);savePlaylists();scheduleCloudSave();renderTab("Playlist:"+imported.id);Toast.makeText(this,"Playlist added to your library",Toast.LENGTH_SHORT).show();}).show());}catch(Exception error){main.post(()->Toast.makeText(this,"Could not open shared playlist. Check your connection and link.",Toast.LENGTH_LONG).show());}});}
    private Track resolveSharedTrack(Track shared){try{String query=shared.title+" "+shared.artist;ArrayList<Track> matches;switch(providerKey(shared.id)){case "saavn":matches=searchSaavn(query);break;case "audius":matches=searchAudius(query);break;case "gaana":matches=searchGaana(query);break;case "jamendo":matches=searchJamendo(query);break;default:return shared;}for(Track candidate:matches)if(candidate.id.equals(shared.id))return new Track(shared.id,shared.title,shared.artist,candidate.streamUrl,shared.imageUrl.isEmpty()?candidate.imageUrl:shared.imageUrl,shared.source);String title=normalizeTrackText(shared.title);for(Track candidate:matches)if(normalizeTrackText(candidate.title).equals(title)&&!candidate.streamUrl.isEmpty())return new Track(shared.id,shared.title,shared.artist,candidate.streamUrl,shared.imageUrl.isEmpty()?candidate.imageUrl:shared.imageUrl,shared.source);}catch(Exception ignored){}return shared;}
    private String normalizeTrackText(String value){return value==null?"":value.toLowerCase(java.util.Locale.ROOT).replaceAll("[^a-z0-9]","");}

    private LinearLayout addTrackRow(Track track) {
        LinearLayout row = new LinearLayout(this);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(10), dp(8), dp(8), dp(8));
        row.setBackground(round(PANEL, 14));
        TextView art = text("♫", 19, WHITE, true);
        art.setGravity(Gravity.CENTER);
        art.setBackground(round(colorFor(track.id), 12));
        row.addView(art, new LinearLayout.LayoutParams(dp(48), dp(48)));
        LinearLayout labels = new LinearLayout(this);
        labels.setOrientation(LinearLayout.VERTICAL);
        labels.setPadding(dp(10), 0, dp(4), 0);
        labels.addView(text(track.title, 14, WHITE, true));
        labels.addView(text(track.artist + " · " + track.source, 11, MUTED, false));
        row.addView(labels, new LinearLayout.LayoutParams(0, -2, 1));
        TextView like = text(isFavorite(track) ? "♥" : "♡", 22, ACCENT, true);
        like.setGravity(Gravity.CENTER);
        like.setOnClickListener(v -> toggleFavorite(track));
        row.addView(like, new LinearLayout.LayoutParams(dp(34), dp(44)));
        TextView enqueue = text("＋", 22, WHITE, true); enqueue.setGravity(Gravity.CENTER);
        enqueue.setOnClickListener(v -> { if(currentTrack==null){playFromCurrentList(track);Toast.makeText(this,"Now playing",Toast.LENGTH_SHORT).show();}else{playQueue.add(track);Toast.makeText(this,"Added to queue",Toast.LENGTH_SHORT).show();} });
        row.addView(enqueue,new LinearLayout.LayoutParams(dp(34),dp(44)));
        TextView addPlaylist = text("▤", 18, WHITE, true); addPlaylist.setGravity(Gravity.CENTER); addPlaylist.setOnClickListener(v->addTrackToPlaylist(track));
        row.addView(addPlaylist,new LinearLayout.LayoutParams(dp(34),dp(44)));
        TextView play = text("▶", 18, WHITE, true);
        play.setGravity(Gravity.CENTER);
        play.setOnClickListener(v -> { playFromCurrentList(track); renderTab("Player"); });
        row.addView(play, new LinearLayout.LayoutParams(dp(40), dp(44)));
        content.addView(row, marginParams(-1, -2, 0, 0, 0, 8));
        return row;
    }

    private void addTrackToPlaylist(Track track){
        if(playlists.isEmpty()){new AlertDialog.Builder(this).setMessage("Create a playlist to save this song.").setNegativeButton("Cancel",null).setPositiveButton("Create playlist",(d,w)->{EditText input=new EditText(this);input.setSingleLine(true);input.setHint("Playlist name");new AlertDialog.Builder(this).setTitle("Create playlist").setView(input).setNegativeButton("Cancel",null).setPositiveButton("Create",(dialog,which)->{String name=input.getText().toString().trim();if(name.isEmpty())return;UserPlaylist p=new UserPlaylist("p_"+System.currentTimeMillis(),name);p.tracks.add(track);playlists.add(0,p);savePlaylists();scheduleCloudSave();Toast.makeText(this,"Added to "+name,Toast.LENGTH_SHORT).show();if("Library".equals(activeTab))renderTab("Library");}).show();}).show();return;}
        String[] names=new String[playlists.size()+1];for(int i=0;i<playlists.size();i++)names[i]=playlists.get(i).name;names[names.length-1]="＋ New playlist";
        new AlertDialog.Builder(this).setTitle("Add to playlist").setItems(names,(dialog,index)->{if(index==playlists.size()){EditText input=new EditText(this);input.setSingleLine(true);input.setHint("Playlist name");new AlertDialog.Builder(this).setTitle("Create playlist").setView(input).setNegativeButton("Cancel",null).setPositiveButton("Create",(d,w)->{String name=input.getText().toString().trim();if(name.isEmpty())return;UserPlaylist p=new UserPlaylist("p_"+System.currentTimeMillis(),name);p.tracks.add(track);playlists.add(0,p);savePlaylists();scheduleCloudSave();Toast.makeText(this,"Added to "+name,Toast.LENGTH_SHORT).show();}).show();}else{UserPlaylist p=playlists.get(index);p.tracks.add(track);p.updatedAt=System.currentTimeMillis();savePlaylists();scheduleCloudSave();if(p.publicPlaylist)publishPlaylist(p);Toast.makeText(this,"Added to "+p.name,Toast.LENGTH_SHORT).show();}}).show();
    }

    private void playTrack(Track track) { playTrackAt(track,0); }
    private void playTrackAt(Track track,int startPositionMs) {
        boolean queued=false;for(Track item:playQueue)if(item.id.equals(track.id)){queued=true;break;}if(!queued){playQueue.clear();playQueue.add(track);}
        currentTrack = track;
        playerPanel.setVisibility(View.VISIBLE);
        playerTitle.setText(track.title);
        playerSubtitle.setText(track.artist);
        playPause.setText("Ⅱ");
        history.removeIf(item -> item.id.equals(track.id));
        history.add(0, track);
        if (history.size() > 30) history.remove(history.size() - 1);
        saveTracks();
        scheduleCloudSave();
        releasePlayer();
        try {
            mediaPlayer = new MediaPlayer();
            mediaPlayer.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build());
            mediaPlayer.setDataSource(this, Uri.parse(track.streamUrl));
            mediaPlayer.setOnPreparedListener(player -> { if(startPositionMs>0)player.seekTo(startPositionMs);player.start(); playPause.setText("Ⅱ"); attachAudioEffects(player.getAudioSessionId());updatePlaybackNotification(true); });
            mediaPlayer.setOnCompletionListener(player -> {if(repeatMode==2){player.seekTo(0);player.start();return;}int next=currentQueueIndex()+1;if(next<playQueue.size())playFromQueueIndex(next);else if(repeatMode==1&&!playQueue.isEmpty())playFromQueueIndex(0);else{playPause.setText("▶");saveResumeState();updatePlaybackNotification(false);}});
            mediaPlayer.setOnErrorListener((player, what, extra) -> { playPause.setText("▶");updatePlaybackNotification(false); Toast.makeText(this, "This stream could not be played.", Toast.LENGTH_LONG).show(); return true; });
            mediaPlayer.prepareAsync();
        } catch (Exception error) {
            playPause.setText("▶");
            Toast.makeText(this, "Could not start this track.", Toast.LENGTH_LONG).show();
        }
    }

    private void togglePlayback() {
        if(mediaPlayer==null&&currentTrack!=null){playTrackAt(currentTrack,resumePositionMs);resumePositionMs=0;return;}
        if (mediaPlayer == null) return;
        try {
            if (mediaPlayer.isPlaying()) { mediaPlayer.pause(); playPause.setText("▶");updatePlaybackNotification(false); }
            else { mediaPlayer.start(); playPause.setText("Ⅱ");updatePlaybackNotification(true); }
        } catch (IllegalStateException ignored) { }
    }

    private void updatePlaybackNotification(boolean playing){if(currentTrack==null)return;if(android.os.Build.VERSION.SDK_INT>=33&&checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=android.content.pm.PackageManager.PERMISSION_GRANTED&&!getPreferences().getBoolean("notification_permission_asked",false)){getPreferences().edit().putBoolean("notification_permission_asked",true).apply();requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS},71);}Intent intent=new Intent(this,MediaPlaybackService.class).setAction(MediaPlaybackService.ACTION_UPDATE).putExtra("title",currentTrack.title).putExtra("artist",currentTrack.artist).putExtra("playing",playing).putExtra("position",(long)safePosition()).putExtra("duration",(long)safeDuration());if(android.os.Build.VERSION.SDK_INT>=26)startForegroundService(intent);else startService(intent);}
    private void handleMediaControl(String action){if(action==null)return;switch(action){case "play":if(mediaPlayer==null&&currentTrack!=null)playTrackAt(currentTrack,resumePositionMs);else if(!safeIsPlaying())togglePlayback();break;case "pause":if(safeIsPlaying())togglePlayback();break;case "next":playFromQueueIndex(currentQueueIndex()+1);break;case "previous":playFromQueueIndex(Math.max(0,currentQueueIndex()-1));break;case "open":renderTab("Player");break;} }

    private void renderFullPlayer() {
        content.setPadding(dp(20), dp(14), dp(20), dp(28));
        if (currentTrack == null) { addHeading("Now playing", "Choose a song first."); return; }
        TextView close = text("‹   Now playing", 17, WHITE, true);
        close.setPadding(0, 0, 0, dp(18)); close.setOnClickListener(v -> renderTab("Home")); content.addView(close);
        ImageView artwork = new ImageView(this); artwork.setScaleType(ImageView.ScaleType.CENTER_CROP); artwork.setBackground(round(colorFor(currentTrack.id), 18));
        LinearLayout.LayoutParams artParams = new LinearLayout.LayoutParams(-1, dp(300)); artParams.setMargins(dp(8), dp(8), dp(8), dp(22)); content.addView(artwork, artParams); loadArtwork(currentTrack.imageUrl, artwork);
        LinearLayout titleRow = new LinearLayout(this); titleRow.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout titleBlock = new LinearLayout(this); titleBlock.setOrientation(LinearLayout.VERTICAL); titleBlock.addView(text(currentTrack.title, 23, WHITE, true)); titleBlock.addView(text(currentTrack.artist, 15, MUTED, false));
        titleRow.addView(titleBlock, new LinearLayout.LayoutParams(0, -2, 1));
        TextView like = text(isFavorite(currentTrack) ? "♥" : "♡", 28, ACCENT, true); like.setOnClickListener(v -> { Track track=currentTrack; toggleFavorite(track); like.setText(isFavorite(track)?"♥":"♡"); }); titleRow.addView(like);
        content.addView(titleRow, marginParams(-1, -2, 0, 4, 0, 14));
        SeekBar progress = new SeekBar(this); fullPlayerProgress=progress; progress.setMax(1000); progress.setProgress(safeDuration()==0?0:(int)(safePosition()*1000f/safeDuration()));
        progress.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            public void onProgressChanged(SeekBar bar,int value,boolean fromUser) { if(fromUser&&mediaPlayer!=null) try{mediaPlayer.seekTo((int)(safeDuration()*value/1000f));}catch(Exception ignored){} }
            public void onStartTrackingTouch(SeekBar bar){seekInProgress=true;} public void onStopTrackingTouch(SeekBar bar){seekInProgress=false;}
        }); content.addView(progress, marginParams(-1, dp(30), 0, 0, 0, 12));
        LinearLayout controls=new LinearLayout(this); controls.setGravity(Gravity.CENTER); controls.setPadding(0,0,0,dp(22));
        TextView shuffle=text(shuffleEnabled?"🔀":"⇄",18,shuffleEnabled?ACCENT:MUTED,true);shuffle.setGravity(Gravity.CENTER);shuffle.setOnClickListener(v->{shuffleEnabled=!shuffleEnabled;getPreferences().edit().putBoolean("shuffle",shuffleEnabled).apply();if(shuffleEnabled&&playQueue.size()>2){int current=Math.max(0,currentQueueIndex());ArrayList<Track> rest=new ArrayList<>(playQueue.subList(Math.min(current+1,playQueue.size()),playQueue.size()));Collections.shuffle(rest);for(int i=0;i<rest.size();i++)playQueue.set(current+1+i,rest.get(i));}renderTab("Player");});
        TextView previous=text("⏮",24,WHITE,true); previous.setGravity(Gravity.CENTER); previous.setOnClickListener(v->playFromQueueIndex(Math.max(0,currentQueueIndex()-1)));
        TextView toggle=text(safeIsPlaying()?"Ⅱ":"▶",28,BG,true); toggle.setGravity(Gravity.CENTER); toggle.setBackground(round(WHITE,40)); toggle.setOnClickListener(v->{togglePlayback();toggle.setText(safeIsPlaying()?"Ⅱ":"▶");});
        TextView next=text("⏭",24,WHITE,true); next.setGravity(Gravity.CENTER); next.setOnClickListener(v->playFromQueueIndex(currentQueueIndex()+1));
        TextView repeat=text(repeatMode==2?"↻1":"↻",18,repeatMode==0?MUTED:ACCENT,true);repeat.setGravity(Gravity.CENTER);repeat.setOnClickListener(v->{repeatMode=(repeatMode+1)%3;getPreferences().edit().putInt("repeat_mode",repeatMode).apply();Toast.makeText(this,repeatMode==0?"Repeat off":repeatMode==1?"Repeat all":"Repeat one",Toast.LENGTH_SHORT).show();renderTab("Player");});
        controls.addView(shuffle,new LinearLayout.LayoutParams(dp(46),dp(58)));controls.addView(previous,new LinearLayout.LayoutParams(dp(52),dp(58))); controls.addView(toggle,new LinearLayout.LayoutParams(dp(62),dp(58))); controls.addView(next,new LinearLayout.LayoutParams(dp(52),dp(58)));controls.addView(repeat,new LinearLayout.LayoutParams(dp(46),dp(58))); content.addView(controls);
        Button queueButton=button("☷   Playing queue · "+playQueue.size()+" songs");queueButton.setOnClickListener(v->renderTab("Queue"));content.addView(queueButton,marginParams(-1,dp(48),0,0,0,14));
        Button lyricToggle=button(lyricsOpen?"♫   Lyrics                         ⌃":"♫   Lyrics                         ⌄"); lyricToggle.setGravity(Gravity.CENTER_VERTICAL|Gravity.START);
        lyricToggle.setOnClickListener(v->{lyricsOpen=!lyricsOpen;if(lyricsOpen&&!currentTrack.id.equals(lyricsTrackId))loadLyrics(currentTrack);else renderTab("Player");}); content.addView(lyricToggle,marginParams(-1,dp(56),0,0,0,12));
        if(lyricsOpen) { LinearLayout lyricCard=card(); if(lyricsLoading) lyricCard.addView(text("Finding lyrics…",15,MUTED,false)); else if(!lyricsText.isEmpty()) { lyricsScroll=new ScrollView(this);LinearLayout lyricColumn=new LinearLayout(this);lyricColumn.setOrientation(LinearLayout.VERTICAL);lyricColumn.setGravity(Gravity.CENTER_HORIZONTAL);if(!lyricLines.isEmpty()){for(LyricLine line:lyricLines){TextView lyric=text(line.text,18,MUTED,true);lyric.setGravity(Gravity.CENTER);lyric.setPadding(dp(8),dp(10),dp(8),dp(10));lyricColumn.addView(lyric,new LinearLayout.LayoutParams(-1,-2));lyricViews.add(lyric);}}else{TextView lyric=text(lyricsText,18,WHITE,true);lyric.setGravity(Gravity.CENTER);lyric.setLineSpacing(dp(9),1f);lyricColumn.addView(lyric);}lyricsScroll.addView(lyricColumn);lyricCard.addView(lyricsScroll,new LinearLayout.LayoutParams(-1,dp(260)));lyricCard.addView(text("Lyrics provided by LRCLIB",11,MUTED,false));updateLyricsHighlight(); } else { lyricCard.addView(text("Lyrics aren’t available for this song yet.",14,MUTED,false));Button retry=button("Try again");retry.setOnClickListener(v->loadLyrics(currentTrack));lyricCard.addView(retry); } content.addView(lyricCard,marginParams(-1,-2,0,0,0,20)); }
        if(lyricsOpen||fullPlayerProgress!=null)main.postDelayed(playerDetailsTicker,450);
        addSectionTitle("Sound"); addSoundControls();Button spatial=button(spatialEnabled?"8D audio · On":"8D audio · Off");spatial.setOnClickListener(v->{spatialEnabled=!spatialEnabled;spatialStartedAt=System.currentTimeMillis();saveAudioSettings();renderTab("Player");});content.addView(spatial,marginParams(-1,dp(44),0,4,0,10));addSectionTitle("5-band equalizer");
        String[] names={"60 Hz","230 Hz","910 Hz","3.6 kHz","14 kHz"}; for(int i=0;i<names.length;i++){final int band=i;addEffectSlider(names[i],-12,12,eqDb[i],value->{eqDb[band]=value;activePreset="Custom";applyEqualizer();});}
        Button back=button("Done");back.setOnClickListener(v->renderTab("Home"));content.addView(back,marginParams(-1,dp(48),0,dp(15),0,10));
    }

    private interface IntChange { void onChange(int value); }
    private void renderQueue(){
        int current=currentQueueIndex();addHeading("Playing queue",current<0?"Your upcoming songs":"Now playing · "+playQueue.size()+" songs in queue");
        if(playQueue.isEmpty()){addNote("Play a song from Home, Search, or Library to start a queue.");return;}
        Button clear=button("Clear upcoming songs");clear.setOnClickListener(v->{if(current>=0){Track now=playQueue.get(current);playQueue.clear();playQueue.add(now);}else playQueue.clear();renderTab("Queue");});content.addView(clear,marginParams(-1,dp(44),0,0,0,12));
        for(int i=0;i<playQueue.size();i++){final int index=i;Track track=playQueue.get(i);LinearLayout row=card();row.setGravity(Gravity.CENTER_VERTICAL);LinearLayout info=new LinearLayout(this);info.setOrientation(LinearLayout.VERTICAL);info.addView(text((index==current?"▶  NOW PLAYING  ·  ":(index<current?"✓  ":""))+track.title,15,WHITE,true));info.addView(text(track.artist,12,MUTED,false));info.setOnClickListener(v->playFromQueueIndex(index));row.addView(info,new LinearLayout.LayoutParams(0,-2,1));if(index>current){TextView up=text("↑",20,WHITE,true);up.setGravity(Gravity.CENTER);up.setOnClickListener(v->{Collections.swap(playQueue,index,index-1);renderTab("Queue");});row.addView(up,new LinearLayout.LayoutParams(dp(38),dp(42)));TextView down=text("↓",20,WHITE,true);down.setGravity(Gravity.CENTER);down.setOnClickListener(v->{if(index+1<playQueue.size())Collections.swap(playQueue,index,index+1);renderTab("Queue");});row.addView(down,new LinearLayout.LayoutParams(dp(38),dp(42)));TextView remove=text("×",22,MUTED,true);remove.setGravity(Gravity.CENTER);remove.setOnClickListener(v->{playQueue.remove(index);renderTab("Queue");});row.addView(remove,new LinearLayout.LayoutParams(dp(38),dp(42)));}content.addView(row,marginParams(-1,-2,0,0,0,7));}
    }
    private void addSoundControls() {
        String[] names={"Flat","Bass Boost","Bass Boost+","Treble","Vocal","Electronic","Pop","Rock","Hip-hop"};
        int[][] bands={{0,0,0,0,0},{3,2,0,0,0},{5,3,0,-1,0},{0,0,0,3,6},{-2,-1,3,4,1},{4,2,-1,2,4},{-1,2,4,2,-1},{4,2,-2,2,5},{5,3,0,1,2}};
        int[] basses={0,8,14,0,0,5,0,2,8};
        for(int i=0;i<names.length;i++){final int index=i;Button preset=button((activePreset.equals(names[i])?"✓ ":"")+names[i]);preset.setOnClickListener(v->{activePreset=names[index];bassDb=basses[index];eqDb=bands[index].clone();applyEqualizer();applyBass();saveAudioSettings();renderTab("Player");});content.addView(preset,marginParams(-1,dp(42),0,3,0,3));}
        addEffectSlider("Bass boost",0,15,bassDb,value->{bassDb=value;activePreset="Custom";applyBass();saveAudioSettings();});
        addEffectSlider("Volume boost",-6,6,volumeDb,value->{volumeDb=value;activePreset="Custom";applyLoudness();saveAudioSettings();});
        addNote("Effects are applied to the Android audio session when supported by the device.");
    }
    private void saveAudioSettings(){android.content.SharedPreferences.Editor e=getPreferences().edit().putInt("fx_bass",bassDb).putInt("fx_volume",volumeDb).putString("fx_preset",activePreset).putBoolean("fx_spatial",spatialEnabled);for(int i=0;i<eqDb.length;i++)e.putInt("fx_eq_"+i,eqDb[i]);e.apply();}
    private void addEffectSlider(String label,int min,int max,int value,IntChange change){LinearLayout row=new LinearLayout(this);row.setGravity(Gravity.CENTER_VERTICAL);row.addView(text(label,13,WHITE,false),new LinearLayout.LayoutParams(dp(86),-2));SeekBar bar=new SeekBar(this);bar.setMax(max-min);bar.setProgress(value-min);row.addView(bar,new LinearLayout.LayoutParams(0,dp(38),1));TextView amount=text((value>0?"+":"")+value+" dB",12,MUTED,false);amount.setGravity(Gravity.RIGHT|Gravity.CENTER_VERTICAL);row.addView(amount,new LinearLayout.LayoutParams(dp(56),-2));bar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){public void onProgressChanged(SeekBar s,int p,boolean from){if(from){int n=p+min;amount.setText((n>0?"+":"")+n+" dB");change.onChange(n);}}public void onStartTrackingTouch(SeekBar s){}public void onStopTrackingTouch(SeekBar s){}});content.addView(row,marginParams(-1,dp(42),0,0,0,4));}

    private void loadLyrics(Track track){lyricsTrackId=track.id;lyricsLoading=true;lyricsText="";lyricsRawSynced="";activeLyricLine=-1;lyricLines.clear();renderTab("Player");requests.execute(()->{String plain="",synced="";try{String exact="https://lrclib.net/api/get?track_name="+encode(track.title)+"&artist_name="+encode(track.artist);JSONObject data=requestLyricsJson(exact);if(data==null){String search="https://lrclib.net/api/search?track_name="+encode(track.title)+"&artist_name="+encode(track.artist);JSONArray results=requestLyricsArray(search);data=bestLyricsResult(results,track);}if(data!=null){plain=data.optString("plainLyrics","");synced=data.optString("syncedLyrics","");if(plain.isEmpty()&&!synced.isEmpty())plain=stripTimestamps(synced);}}catch(Exception ignored){}final String found=plain, timed=synced;main.post(()->{if(currentTrack!=null&&currentTrack.id.equals(track.id)){lyricsLoading=false;lyricsText=found;lyricsRawSynced=timed;lyricLines.clear();lyricLines.addAll(parseLyricLines(timed));activeLyricLine=-1;renderTab("Player");}});});}
    private JSONObject requestLyricsJson(String address)throws Exception{HttpURLConnection c=(HttpURLConnection)new URL(address).openConnection();c.setConnectTimeout(8000);c.setReadTimeout(8000);c.setRequestProperty("User-Agent","Wavelength/1.0 (Android)");int status=c.getResponseCode();if(status==404){c.disconnect();return null;}if(status<200||status>=300){c.disconnect();return null;}JSONObject data=new JSONObject(readResponse(c));c.disconnect();return data;}
    private JSONArray requestLyricsArray(String address)throws Exception{HttpURLConnection c=(HttpURLConnection)new URL(address).openConnection();c.setConnectTimeout(8000);c.setReadTimeout(8000);c.setRequestProperty("User-Agent","Wavelength/1.0 (Android)");int status=c.getResponseCode();if(status<200||status>=300){c.disconnect();return null;}JSONArray data=new JSONArray(readResponse(c));c.disconnect();return data;}
    private JSONObject bestLyricsResult(JSONArray results,Track track){if(results==null)return null;String title=normalizeLyrics(track.title),artist=normalizeLyrics(track.artist);int best=Integer.MIN_VALUE;JSONObject chosen=null;for(int i=0;i<results.length();i++){JSONObject item=results.optJSONObject(i);if(item==null||(!item.has("plainLyrics")&&!item.has("syncedLyrics")))continue;String foundTitle=normalizeLyrics(item.optString("trackName",item.optString("name"))),foundArtist=normalizeLyrics(item.optString("artistName"));int score=foundTitle.equals(title)?3:(foundTitle.contains(title)||title.contains(foundTitle)?1:-4);if(foundArtist.equals(artist))score+=3;else if(foundArtist.contains(artist)||artist.contains(foundArtist))score++;if(score>=4&&score>best){best=score;chosen=item;}}return chosen;}
    private String normalizeLyrics(String value){return value.toLowerCase(java.util.Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]+"," ").trim();}
    private ArrayList<LyricLine> parseLyricLines(String value){ArrayList<LyricLine> lines=new ArrayList<>();if(value==null||value.isEmpty())return lines;Pattern stamp=Pattern.compile("\\[(\\d{1,3}):(\\d{2})(?:[.:](\\d{1,3}))?\\]");for(String raw:value.split("\\r?\\n")){Matcher matcher=stamp.matcher(raw);String clean=raw.replaceAll("\\[[^\\]]+\\]","").trim();if(clean.isEmpty())continue;while(matcher.find()){String fraction=matcher.group(3)==null?"0":matcher.group(3);if(fraction.length()==1)fraction+="00";else if(fraction.length()==2)fraction+="0";long millis=(Long.parseLong(matcher.group(1))*60+Long.parseLong(matcher.group(2)))*1000+Long.parseLong(fraction);lines.add(new LyricLine(millis,clean));}}Collections.sort(lines,(a,b)->Long.compare(a.timeMs,b.timeMs));return lines;}
    private void updateLyricsHighlight(){if(lyricLines.isEmpty()||lyricViews.size()!=lyricLines.size())return;long position=safePosition();int active=0;for(int i=0;i<lyricLines.size();i++){if(lyricLines.get(i).timeMs<=position)active=i;lyricViews.get(i).setTextColor(i==active?ACCENT:MUTED);}if(active!=activeLyricLine&&lyricsScroll!=null&&active>=0){activeLyricLine=active;View view=lyricViews.get(active);lyricsScroll.post(()->lyricsScroll.smoothScrollTo(0,Math.max(0,view.getTop()-dp(80))));}}
    private final Runnable playerDetailsTicker=new Runnable(){@Override public void run(){if(!"Player".equals(activeTab))return;if(fullPlayerProgress!=null&&!seekInProgress){int duration=safeDuration();if(duration>0)fullPlayerProgress.setProgress((int)(safePosition()*1000f/duration));}updateLyricsHighlight();main.postDelayed(this,450);}};
    private String readResponse(HttpURLConnection c)throws Exception{int status=c.getResponseCode();InputStream in=status>=200&&status<300?c.getInputStream():c.getErrorStream();if(in==null)throw new java.io.IOException("No response");ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] bytes=new byte[2048];int n;while((n=in.read(bytes))!=-1)out.write(bytes,0,n);in.close();if(status<200||status>=300)throw new java.io.IOException("Lyrics unavailable");return out.toString("UTF-8");}
    private String stripTimestamps(String value){return value.replaceAll("(?m)^\\[[0-9:.]+\\]","").replaceAll("(?m)^\\s*$","").trim();}
    private void playHistory(int direction){if(history.isEmpty()||currentTrack==null)return;int index=0;for(int i=0;i<history.size();i++)if(history.get(i).id.equals(currentTrack.id)){index=i;break;}playTrack(history.get((index+direction+history.size())%history.size()));renderTab("Player");}
    private int currentQueueIndex(){if(currentTrack==null)return -1;for(int i=0;i<playQueue.size();i++)if(playQueue.get(i).id.equals(currentTrack.id))return i;return -1;}
    private void playFromQueue(ArrayList<Track> tracks,Track selected){playQueue.clear();playQueue.addAll(tracks);playTrack(selected);if(shuffleEnabled){int current=currentQueueIndex();if(current>=0){ArrayList<Track> rest=new ArrayList<>(playQueue.subList(current+1,playQueue.size()));Collections.shuffle(rest);for(int i=0;i<rest.size();i++)playQueue.set(current+1+i,rest.get(i));}}}
    private void playFromQueueIndex(int index){if(index<0||index>=playQueue.size())return;playTrack(playQueue.get(index));renderTab("Player");}
    private void playFromCurrentList(Track track){if("Search".equals(activeTab))playFromQueue(searchResults,track);else if("History".equals(activeTab))playFromQueue(history,track);else if("Library".equals(activeTab))playFromQueue(favorites,track);else if("Local".equals(activeTab))playFromQueue(localTracks,track);else if(activeTab.startsWith("Playlist:")){String id=activeTab.substring(9);for(UserPlaylist p:playlists)if(p.id.equals(id)){playFromQueue(p.tracks,track);return;}playTrack(track);}else playTrack(track);}
    private boolean safeIsPlaying(){try{return mediaPlayer!=null&&mediaPlayer.isPlaying();}catch(Exception ignored){return false;}}
    private void attachAudioEffects(int session){releaseAudioEffects();try{equalizer=new Equalizer(0,session);equalizer.setEnabled(true);applyEqualizer();}catch(Exception ignored){equalizer=null;}try{bassBoost=new BassBoost(0,session);bassBoost.setEnabled(true);applyBass();}catch(Exception ignored){bassBoost=null;}try{loudnessEnhancer=new LoudnessEnhancer(session);loudnessEnhancer.setEnabled(true);applyLoudness();}catch(Exception ignored){loudnessEnhancer=null;}}
    private void applyEqualizer(){if(equalizer==null)return;try{short bands=equalizer.getNumberOfBands();short[] range=equalizer.getBandLevelRange();int[] hz={60,230,910,3600,14000};for(short band=0;band<bands;band++){int center=equalizer.getCenterFreq(band)/1000,nearest=0;for(int i=1;i<hz.length;i++)if(Math.abs(hz[i]-center)<Math.abs(hz[nearest]-center))nearest=i;equalizer.setBandLevel(band,(short)Math.max(range[0],Math.min(range[1],eqDb[nearest]*100)));}}catch(Exception ignored){}}
    private void applyBass(){if(bassBoost!=null)try{bassBoost.setStrength((short)Math.min(1000,bassDb*65));}catch(Exception ignored){}}
    private void applyLoudness(){if(loudnessEnhancer!=null)try{loudnessEnhancer.setTargetGain(volumeDb*100);}catch(Exception ignored){}}
    private void releaseAudioEffects(){if(equalizer!=null){try{equalizer.release();}catch(Exception ignored){}equalizer=null;}if(bassBoost!=null){try{bassBoost.release();}catch(Exception ignored){}bassBoost=null;}if(loudnessEnhancer!=null){try{loudnessEnhancer.release();}catch(Exception ignored){}loudnessEnhancer=null;}}

    private void pickLocalAudio() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("audio/*");
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(intent, 42);
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if(requestCode==43&&resultCode==RESULT_OK&&data!=null&&data.getData()!=null){try{profilePhotoData=makeProfileDataUrl(data.getData());getPreferences().edit().putString("profile_photo",profilePhotoData).apply();scheduleCloudSave();Toast.makeText(this,"Profile photo updated",Toast.LENGTH_SHORT).show();renderTab("Account");}catch(Exception error){Toast.makeText(this,"Could not use that image",Toast.LENGTH_LONG).show();}return;}
        if (requestCode == 42 && resultCode == RESULT_OK && data != null && (data.getData() != null || data.getClipData() != null)) {
            ArrayList<Uri> selected=new ArrayList<>();if(data.getClipData()!=null){for(int i=0;i<data.getClipData().getItemCount();i++)selected.add(data.getClipData().getItemAt(i).getUri());}else selected.add(data.getData());int added=0;for(Uri uri:selected){try{getContentResolver().takePersistableUriPermission(uri,Intent.FLAG_GRANT_READ_URI_PERMISSION);}catch(Exception ignored){}String name="Audio from this device";try(android.database.Cursor cursor=getContentResolver().query(uri,null,null,null,null)){if(cursor!=null&&cursor.moveToFirst()){int column=cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME);if(column>=0)name=cursor.getString(column);}}catch(Exception ignored){}String id="local:"+uri;boolean exists=false;for(Track t:localTracks)if(t.id.equals(id)){exists=true;break;}if(!exists){localTracks.add(new Track(id,name,"On this device",uri.toString(),"","Device"));added++;}}saveLocalTracks();Toast.makeText(this,added+" song"+(added==1?"":"s")+" added",Toast.LENGTH_SHORT).show();renderTab("Local");
        }
    }

    private void loadLocalTracks(){try{JSONArray saved=new JSONArray(getPreferences().getString("local_tracks","[]"));for(int i=0;i<saved.length();i++){JSONObject item=saved.optJSONObject(i);if(item!=null){String uri=item.optString("stream");try{getContentResolver().takePersistableUriPermission(Uri.parse(uri),Intent.FLAG_GRANT_READ_URI_PERMISSION);}catch(Exception ignored){}localTracks.add(new Track(item.optString("id"),item.optString("title"),"On this device",uri,"","Device"));}}}catch(Exception ignored){}}
    private void saveLocalTracks(){try{JSONArray values=new JSONArray();for(Track t:localTracks){JSONObject item=new JSONObject();item.put("id",t.id);item.put("title",t.title);item.put("stream",t.streamUrl);values.put(item);}getPreferences().edit().putString("local_tracks",values.toString()).apply();saveTracks();}catch(Exception ignored){}}

    private String makeProfileDataUrl(Uri uri)throws Exception{BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;try(InputStream input=getContentResolver().openInputStream(uri)){BitmapFactory.decodeStream(input,null,bounds);}int sample=1;while(Math.min(bounds.outWidth/sample,bounds.outHeight/sample)>512)sample*=2;BitmapFactory.Options options=new BitmapFactory.Options();options.inSampleSize=sample;Bitmap source;try(InputStream input=getContentResolver().openInputStream(uri)){source=BitmapFactory.decodeStream(input,null,options);}if(source==null)throw new java.io.IOException("Image decode failed");int side=Math.min(source.getWidth(),source.getHeight()),left=(source.getWidth()-side)/2,top=(source.getHeight()-side)/2;Bitmap square=Bitmap.createBitmap(source,left,top,side,side);Bitmap resized=Bitmap.createScaledBitmap(square,256,256,true);ByteArrayOutputStream bytes=new ByteArrayOutputStream();resized.compress(Bitmap.CompressFormat.JPEG,78,bytes);return "data:image/jpeg;base64,"+android.util.Base64.encodeToString(bytes.toByteArray(),android.util.Base64.NO_WRAP);}

    private void toggleFavorite(Track track) {
        if (isFavorite(track)) favorites.removeIf(item -> item.id.equals(track.id));
        else favorites.add(0, track);
        saveTracks();
        scheduleCloudSave();
        if ("Library".equals(activeTab)) renderTab(activeTab);
        else renderTab(activeTab);
    }

    private boolean isFavorite(Track track) {
        for (Track item : favorites) if (item.id.equals(track.id)) return true;
        return false;
    }

    private void loadSavedTracks() {
        try {
            JSONObject saved = new JSONObject(getPreferences().getString("collections", "{}"));
            readTracks(saved.optJSONArray("favorites"), favorites);
            readTracks(saved.optJSONArray("history"), history);
            JSONArray ps=getPreferences().contains("playlists")?new JSONArray(getPreferences().getString("playlists","[]")):saved.optJSONArray("playlists");if(ps!=null)for(int i=0;i<ps.length();i++){JSONObject item=ps.optJSONObject(i);if(item!=null){UserPlaylist p=new UserPlaylist(item.optString("id"),item.optString("name","Playlist"));p.description=item.optString("description");p.cover=item.optString("cover");p.publicPlaylist=item.optBoolean("isPublic");p.shareId=item.optString("shareId");p.createdAt=item.optLong("createdAt",p.createdAt);p.updatedAt=item.optLong("updatedAt",p.updatedAt);JSONArray tracks=item.optJSONArray("tracks");if(tracks!=null)for(int j=0;j<tracks.length();j++){JSONObject t=tracks.optJSONObject(j);if(t!=null)p.tracks.add(new Track(t.optString("id"),t.optString("title"),t.optString("artist"),t.optString("stream",t.optString("url")),t.optString("image",t.optString("img")),t.optString("source",sourceFor(t.optString("id")))));}playlists.add(p);}}
            loadEntities(getPreferences().getString("saved_albums","[]"),savedAlbums,false);loadEntities(getPreferences().getString("followed_artists","[]"),followedArtists,true);try{JSONArray recent=new JSONArray(getPreferences().getString("library_recent","[]"));for(int i=0;i<recent.length();i++)libraryRecent.add(recent.optString(i));}catch(Exception ignored){}librarySort=getPreferences().getString("library_sort","recents");
        } catch (Exception ignored) { }
    }

    private void readTracks(JSONArray from, ArrayList<Track> into) {
        if (from == null) return;
        for (int i = 0; i < from.length(); i++) {
            JSONObject item = from.optJSONObject(i);
            if (item != null) into.add(new Track(item.optString("id"), item.optString("title"), item.optString("artist"), item.optString("stream"), item.optString("image"), item.optString("source")));
        }
    }

    private void saveTracks() {
        try {
            JSONObject saved = new JSONObject();
            saved.put("favorites", trackArray(favorites));
            saved.put("history", trackArray(history));
            saved.put("playlists",playlistArrayLocal());
            getPreferences().edit().putString("collections", saved.toString()).apply();
        } catch (Exception ignored) { }
    }

    private JSONArray playlistArrayLocal()throws Exception{JSONArray out=new JSONArray();for(UserPlaylist p:playlists){JSONObject item=new JSONObject();item.put("id",p.id);item.put("name",p.name);item.put("description",p.description);item.put("cover",p.cover);item.put("isPublic",p.publicPlaylist);item.put("shareId",p.shareId);item.put("createdAt",p.createdAt);item.put("updatedAt",p.updatedAt);JSONArray tracks=new JSONArray();for(Track t:p.tracks){JSONObject x=new JSONObject();x.put("id",t.id);x.put("title",t.title);x.put("artist",t.artist);x.put("stream",t.streamUrl);x.put("image",t.imageUrl);x.put("source",t.source);tracks.put(x);}item.put("tracks",tracks);out.put(item);}return out;}
    private void savePlaylists(){try{getPreferences().edit().putString("playlists",playlistArrayLocal().toString()).apply();saveTracks();}catch(Exception ignored){}}

    private final Runnable resumeSaveTicker=new Runnable(){@Override public void run(){saveResumeState();main.postDelayed(this,5000);}};
    private void saveResumeState(){if(currentTrack==null)return;try{JSONObject snapshot=new JSONObject();snapshot.put("track",trackJson(currentTrack));snapshot.put("position",safePosition()>0?safePosition():resumePositionMs);snapshot.put("duration",safeDuration());JSONArray queue=new JSONArray();for(Track item:playQueue)queue.put(trackJson(item));snapshot.put("queue",queue);snapshot.put("updatedAt",System.currentTimeMillis());getPreferences().edit().putString("resume_state",snapshot.toString()).apply();}catch(Exception ignored){}}
    private void restoreResumeState(){try{String raw=getPreferences().getString("resume_state","");if(raw.isEmpty())return;JSONObject snapshot=new JSONObject(raw);Track track=trackFrom(snapshot.optJSONObject("track"));if(track==null||track.streamUrl.isEmpty())return;currentTrack=track;resumePositionMs=Math.max(0,snapshot.optInt("position",0));JSONArray queue=snapshot.optJSONArray("queue");if(queue!=null)for(int i=0;i<queue.length();i++){Track item=trackFrom(queue.optJSONObject(i));if(item!=null)playQueue.add(item);}if(currentQueueIndex()<0)playQueue.add(0,track);playerTitle.setText(track.title);playerSubtitle.setText(track.artist);}catch(Exception ignored){}}

    private void scheduleCloudSave(){if(firebaseUid.isEmpty()||firebaseIdToken.isEmpty())return;requests.execute(()->{try{JSONObject cloud=firestoreGet(firebaseUid);firestoreSave(firebaseUid,mergeAccountData(cloud,accountData()));}catch(Exception ignored){}});}

    private JSONArray trackArray(ArrayList<Track> tracks) throws Exception {
        JSONArray array = new JSONArray();
        for (Track track : tracks) {
            if (track.id.startsWith("local:")) continue;
            JSONObject item = new JSONObject();
            item.put("id", track.id); item.put("title", track.title); item.put("artist", track.artist);
            item.put("stream", track.streamUrl); item.put("image", track.imageUrl); item.put("source", track.source);
            array.put(item);
        }
        return array;
    }

    private android.content.SharedPreferences getPreferences() { return getSharedPreferences(PREFS, MODE_PRIVATE); }
    private int safeDuration() { try { return mediaPlayer == null ? 0 : mediaPlayer.getDuration(); } catch (Exception ignored) { return 0; } }
    private int safePosition() { try { return mediaPlayer == null ? 0 : mediaPlayer.getCurrentPosition(); } catch (Exception ignored) { return 0; } }
    private void releasePlayer() { releaseAudioEffects(); if (mediaPlayer != null) { try { mediaPlayer.stop(); } catch (Exception ignored) { } mediaPlayer.release(); mediaPlayer = null; } }

    private void addHeading(String title, String subtitle) {
        content.addView(text(title, 27, WHITE, true), marginParams(-1, -2, 0, 8, 0, 4));
        content.addView(text(subtitle, 14, MUTED, false), marginParams(-1, -2, 0, 0, 0, 20));
    }
    private void addSectionTitle(String title) { content.addView(text(title, 17, WHITE, true), marginParams(-1, -2, 0, 0, 0, dp(10))); }
    private void addNote(String note) { content.addView(text(note, 14, MUTED, false), marginParams(-1, -2, 0, dp(10), 0, dp(12))); }
    private LinearLayout card() { LinearLayout view = new LinearLayout(this); view.setOrientation(LinearLayout.VERTICAL); view.setPadding(dp(18), dp(18), dp(18), dp(18)); view.setBackground(round(PANEL, 20)); return view; }
    private Button button(String label) { Button b = new Button(this); b.setText(label); b.setTextColor(WHITE); b.setTextSize(14); b.setAllCaps(false); b.setTypeface(Typeface.DEFAULT, Typeface.BOLD); b.setBackground(round(HOVER, 14)); return b; }
    private TextView text(String value, int size, int color, boolean bold) { TextView view = new TextView(this); view.setText(value); view.setTextSize(size); view.setTextColor(color); if (bold) view.setTypeface(Typeface.DEFAULT, Typeface.BOLD); return view; }
    private GradientDrawable round(int color, int radius) { GradientDrawable d = new GradientDrawable(); d.setColor(color); d.setCornerRadius(dp(radius)); return d; }
    private void addSpace(LinearLayout into, int height) { View space = new View(this); into.addView(space, new LinearLayout.LayoutParams(1, dp(height))); }
    private LinearLayout.LayoutParams marginParams(int w, int h, int left, int top, int right, int bottom) { LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(w, h); p.setMargins(dp(left), dp(top), dp(right), dp(bottom)); return p; }
    private int dp(int value) { return (int) (value * getResources().getDisplayMetrics().density + 0.5f); }
    private static int colorFor(String seed) { int[] colors = {Color.rgb(105, 78, 158), Color.rgb(37, 116, 121), Color.rgb(152, 80, 99), Color.rgb(78, 106, 158)}; return colors[Math.abs(seed.hashCode()) % colors.length]; }
    private static String encode(String value) throws Exception { return URLEncoder.encode(value, "UTF-8"); }

    private static final class Track {
        final String id, title, artist, streamUrl, imageUrl, source;
        Track(String id, String title, String artist, String streamUrl, String imageUrl, String source) {
            this.id = id == null ? "" : id; this.title = title == null ? "Unknown title" : title;
            this.artist = artist == null ? "Unknown artist" : artist; this.streamUrl = streamUrl == null ? "" : streamUrl;
            this.imageUrl = imageUrl == null ? "" : imageUrl; this.source = source == null ? "Music" : source;
        }
    }
    private static final class LyricLine{final long timeMs;final String text;LyricLine(long timeMs,String text){this.timeMs=timeMs;this.text=text;}}

    private static final class HomeShelf {
        final String title;
        final ArrayList<Track> tracks;
        HomeShelf(String title, ArrayList<Track> tracks) { this.title = title; this.tracks = tracks; }
    }
    private static final class UserPlaylist{final String id;String name,description="",cover="",shareId="";long createdAt=System.currentTimeMillis(),updatedAt=createdAt;boolean publicPlaylist;final ArrayList<Track> tracks=new ArrayList<>();UserPlaylist(String id,String name){this.id=id;this.name=name;}}
    private static final class SavedEntity{final String id,name,artistName,image,url;final boolean artist;boolean saved;SavedEntity(String id,String name,String artistName,String image,boolean artist,String url){this.id=id;this.name=name;this.artistName=artistName;this.image=image;this.artist=artist;this.url=url;this.saved=true;}}

    @Override public void onBackPressed() {
        if (!"Home".equals(activeTab)) renderTab("Home"); else super.onBackPressed();
    }
    @Override protected void onDestroy() {
        main.removeCallbacks(updateSeek);
        requests.shutdownNow();
        releasePlayer();
        super.onDestroy();
    }
}
